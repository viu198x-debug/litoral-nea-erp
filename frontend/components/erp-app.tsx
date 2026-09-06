"use client";

import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  Banknote,
  BedDouble,
  Bell,
  BookOpenCheck,
  Boxes,
  Building2,
  Calculator,
  CalendarDays,
  ChartGantt,
  ChartNoAxesCombined,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  Construction,
  ContactRound,
  Download,
  DraftingCompass,
  Eye,
  EyeOff,
  Factory,
  FileCheck2,
  Files,
  Filter,
  FolderArchive,
  Fuel,
  HardHat,
  Landmark,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Mail,
  MapPin,
  MapPinned,
  Menu,
  MoreHorizontal,
  Plus,
  ReceiptText,
  Route,
  Search,
  Settings,
  ShieldCheck,
  ShoppingCart,
  SlidersHorizontal,
  TrendingUp,
  Truck,
  Upload,
  UsersRound,
  WalletCards,
  Wrench,
  X,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast, Toaster } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { activity, alerts, cashflow, works } from "@frontend/lib/demo-data";
import { demoAccounts, findDemoAccount } from "@frontend/lib/demo-users";
import { groups, modules } from "@frontend/lib/modules";
import {
  fallbackRecordDefinition,
  recordDefinitions,
} from "@frontend/lib/record-definitions";
import type {
  DemoUser,
  ModuleDefinition,
  RecordFieldDefinition,
  Work,
} from "@frontend/lib/types";

const iconMap: Record<string, LucideIcon> = {
  LayoutDashboard,
  HardHat,
  Building2,
  DraftingCompass,
  FolderArchive,
  Calculator,
  GanttChartSquare: ChartGantt,
  TrendingUp,
  Landmark,
  FileCheck2,
  Files,
  ShoppingCart,
  ContactRound,
  Route,
  Boxes,
  WalletCards,
  ArrowLeftRight: ArrowRight,
  BookOpenCheck,
  ReceiptText,
  Truck,
  BadgeCheck,
  Fuel,
  Construction,
  Factory,
  Wrench,
  UsersRound,
  Banknote,
  MapPinned,
  BedDouble,
  ChartNoAxesCombined,
  ListChecks,
  Settings,
};

const money = (value: number, compact = false) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
    ...(compact ? { notation: "compact", compactDisplay: "short" } : {}),
  }).format(value);

const percent = (value: number) =>
  new Intl.NumberFormat("es-AR", {
    style: "percent",
    maximumFractionDigits: 1,
  }).format(value / 100);

const apiUrl = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "");
const demoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "true" || !apiUrl;
let csrfTokenCache: string | null = null;

const canUseModule = (user: DemoUser, moduleSlug: string) =>
  user.allowedModules.includes("*") || user.allowedModules.includes(moduleSlug);

const canCreateInModule = (user: DemoUser, moduleSlug: string) =>
  user.allowedCreateModules.includes("*") || user.allowedCreateModules.includes(moduleSlug);

const managerProfile: DemoUser = {
  name: "Gerente de Empresa",
  email: "",
  role: "Gerente de Empresa",
  roleCode: "GERENTE_EMPRESA",
  allowedModules: modules.map((module) => module.slug).filter((slug) => slug !== "system"),
  allowedActions: ["view", "create", "modify", "approve", "void", "download", "export", "admin"],
  allowedCreateModules: modules.map((module) => module.slug).filter((slug) => slug !== "system"),
  assignedWorks: [],
  responsibilities: [
    "Dirección integral de la operación de la empresa",
    "Aprobaciones comerciales, financieras y operativas",
    "Seguimiento de obras, personal, compras, contabilidad e impuestos",
    "Reportes gerenciales y control de gestión",
  ],
};

const profileForRoleCodes = (roleCodes: string[]) =>
  roleCodes.includes("GERENTE_EMPRESA")
    ? managerProfile
    : demoAccounts.find((account) => roleCodes.includes(account.roleCode)) ?? demoAccounts[0];

function csrfTokenFromCookie() {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(
    /(?:^|;\s*)(?:__Host-lnea_csrf|lnea_csrf)=([^;]+)/,
  );
  return match ? decodeURIComponent(match[1]) : null;
}

async function ensureCsrfToken() {
  csrfTokenCache ??= csrfTokenFromCookie();
  if (csrfTokenCache) return csrfTokenCache;
  if (!apiUrl) throw new Error("La API no está configurada.");
  const response = await fetch(`${apiUrl}/auth/csrf`, {
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error("No se pudo iniciar una sesión segura.");
  const payload = (await response.json()) as { csrfToken: string };
  csrfTokenCache = payload.csrfToken;
  return payload.csrfToken;
}

async function apiFetch(path: string, init: RequestInit = {}) {
  if (!apiUrl) throw new Error("La API no está configurada.");
  const method = (init.method ?? "GET").toUpperCase();
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
    headers.set("X-CSRF-Token", await ensureCsrfToken());
  }
  return fetch(`${apiUrl}${path}`, {
    ...init,
    method,
    headers,
    credentials: "include",
  });
}

export function ErpApp() {
  const [user, setUser] = useState<DemoUser | null>(null);
  const [entryView, setEntryView] = useState<"landing" | "login">("landing");
  const [oauthMessage, setOauthMessage] = useState("");
  const [activeSlug, setActiveSlug] = useState("dashboard");
  const [selectedWork, setSelectedWork] = useState<Work | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [globalSearch, setGlobalSearch] = useState("");
  const [runtimeWorks, setRuntimeWorks] = useState<Work[]>(works);
  const [runtimeModules, setRuntimeModules] = useState<ModuleDefinition[]>(modules);
  const [configurationRefresh, setConfigurationRefresh] = useState(0);

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 821px)");
    const keepDrawerMobileOnly = () => {
      if (desktop.matches) setSidebarOpen(false);
    };
    keepDrawerMobileOnly();
    desktop.addEventListener("change", keepDrawerMobileOnly);
    return () => desktop.removeEventListener("change", keepDrawerMobileOnly);
  }, []);

  useEffect(() => {
    const refresh = () => setConfigurationRefresh((value) => value + 1);
    window.addEventListener("lnea:module-config-changed", refresh);
    return () => window.removeEventListener("lnea:module-config-changed", refresh);
  }, []);

  useEffect(() => {
    if (!user || demoMode || !apiUrl) return;
    void apiFetch("/configuration/modules")
      .then(async (response) => {
        if (!response.ok) throw new Error("No se pudo cargar el menú autorizado");
        return response.json() as Promise<Array<ConfiguratorModule & { icon: string; actions: string[] }>>;
      })
      .then((configured) => {
        setRuntimeModules(configured.map((module) => ({
          slug: module.slug,
          label: module.label,
          group: module.groupName,
          icon: module.icon,
          summary: module.summary,
          features: module.fields.map((field) => field.label),
          recordDefinition: {
            codePrefix: module.slug.replace(/[^a-z0-9]/gi, "").slice(0, 5).toUpperCase() || "REG",
            titleLabel: "Descripción principal",
            requiresWork: module.requiresWork,
            fields: module.fields
              .filter((field) => field.active)
              .map((field) => ({
                key: field.fieldKey,
                label: field.label,
                type: field.fieldType === "datetime" ? "datetime-local" : field.fieldType as RecordFieldDefinition["type"],
                required: field.required,
                options: field.options,
              })),
          },
        })));
        setUser((current) => current ? {
          ...current,
          allowedModules: configured.map((module) => module.slug),
          allowedCreateModules: configured.filter((module) => module.actions.includes("create")).map((module) => module.slug),
        } : current);
      })
      .catch((cause) => toast.error("No se actualizó el menú", {
        description: cause instanceof Error ? cause.message : "Error de conexión",
      }));
  }, [user?.email, configurationRefresh]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get("oauth");
    if (!status) return;
    setEntryView("login");
    const provider = params.get("provider") === "microsoft" ? "Microsoft" : "Google";
    window.history.replaceState({}, "", window.location.pathname + window.location.hash);
    if (status === "pending") {
      setOauthMessage(
        `Registro con ${provider} recibido. Un administrador debe aprobarlo antes del primer ingreso.`,
      );
      return;
    }
    if (status !== "success" || demoMode) {
      setOauthMessage(`No se pudo completar el acceso con ${provider}.`);
      return;
    }
    setOauthMessage("Validando la sesión corporativa…");
    void apiFetch("/auth/me")
      .then(async (response) => {
        if (!response.ok) throw new Error("Sesión no válida");
        return response.json() as Promise<{
          firstName: string;
          lastName: string;
          email: string;
          roleCodes: string[];
        }>;
      })
      .then((profile) => {
        const accessProfile = profileForRoleCodes(profile.roleCodes);
        setUser({
          ...accessProfile,
          name: `${profile.firstName} ${profile.lastName}`,
          email: profile.email,
          role: profile.roleCodes.join(" · "),
        });
        setOauthMessage("");
      })
      .catch(() => setOauthMessage("La sesión externa no pudo validarse."));
  }, []);

  useEffect(() => {
    const syncHash = () => {
      const parts = window.location.hash.replace(/^#\/?/, "").split("/");
      if (parts[0] && runtimeModules.some((module) => module.slug === parts[0])) {
        setActiveSlug(parts[0]);
      }
      if (parts[0] === "works" && parts[1]) {
        setSelectedWork(works.find((work) => work.id === parts[1]) ?? null);
      }
    };
    syncHash();
    window.addEventListener("hashchange", syncHash);
    return () => window.removeEventListener("hashchange", syncHash);
  }, [runtimeModules]);

  useEffect(() => {
    if (user && !canUseModule(user, activeSlug)) {
      setActiveSlug("dashboard");
      setSelectedWork(null);
      window.location.hash = "/dashboard";
    }
  }, [activeSlug, user]);

  useEffect(() => {
    if (!user || demoMode || !apiUrl) return;
    void apiFetch("/dashboard")
      .then(async (response) => {
        if (!response.ok) throw new Error("No se pudo cargar el dashboard");
        return response.json();
      })
      .then((payload: {
        works?: Array<Record<string, unknown> & {
          client?: { legalName?: string };
        }>;
      }) => {
        if (!payload.works?.length) return;
        setRuntimeWorks(
          payload.works.map((item) => {
            const margin = Number(item.margin ?? 0);
            const name = String(item.name ?? "Obra");
            return {
              id: String(item.id),
              code: String(item.code),
              name,
              client: item.client?.legalName ?? "Cliente",
              city: String(item.city ?? "Corrientes"),
              contractAmount: Number(item.contractAmount ?? 0),
              targetBudget: Number(item.targetBudget ?? 0),
              actualCost: Number(item.actualCost ?? 0),
              physicalProgress: Number(item.physicalProgress ?? 0),
              financialProgress: Number(item.financialProgress ?? 0),
              collectedAmount: Number(item.collectedAmount ?? 0),
              margin,
              responsible: String(item.responsibleName ?? "Sin asignar"),
              status: margin < 10 ? "Atención" : "Normal",
              image: /eléctr|MT\/BT/i.test(name)
                ? "/assets/electrical.webp"
                : /pavimento|cuneta/i.test(name)
                  ? "/assets/roadworks.webp"
                  : "/assets/laboratory.webp",
            };
          }),
        );
      })
      .catch(() =>
        toast.error("La API no está disponible", {
          description: "Se conservan los datos demostrativos en pantalla.",
        }),
      );
  }, [user]);

  const navigate = (slug: string) => {
    if (user && !canUseModule(user, slug)) {
      toast.error("Acceso no autorizado", {
        description: `${user.role} no tiene acceso al módulo solicitado.`,
      });
      return;
    }
    setActiveSlug(slug);
    setSelectedWork(null);
    setSidebarOpen(false);
    window.location.hash = `/${slug}`;
  };

  const openWork = (work: Work) => {
    if (user?.assignedWorks.length && !user.assignedWorks.includes(work.code)) {
      toast.error("Obra no asignada", {
        description: "Este usuario sólo puede registrar movimientos en sus obras habilitadas.",
      });
      return;
    }
    setSelectedWork(work);
    setActiveSlug("works");
    window.location.hash = `/works/${work.id}`;
  };

  const logout = () => {
    if (!demoMode && apiUrl) {
      void apiFetch("/auth/logout", {
        method: "POST",
      });
    }
    csrfTokenCache = null;
    setUser(null);
    setRuntimeWorks(works);
    setEntryView("login");
  };

  if (!user && entryView === "landing") {
    return <LandingPage onLogin={() => setEntryView("login")} />;
  }
  if (!user) {
    return (
      <LoginScreen
        onLogin={setUser}
        onBack={() => setEntryView("landing")}
        oauthMessage={oauthMessage}
      />
    );
  }

  const activeModule =
    runtimeModules.find((module) => module.slug === activeSlug) ?? runtimeModules[0] ?? modules[0];
  const availableWorks = user.assignedWorks.length
    ? runtimeWorks.filter((work) => user.assignedWorks.includes(work.code))
    : runtimeWorks;
  const mayCreate = !["dashboard", "management", "approvals", "system"].includes(activeModule.slug)
    && canCreateInModule(user, activeModule.slug);

  return (
    <>
      <Toaster richColors position="top-right" />
      <div className="erp-app">
        <aside className="desktop-sidebar">
          <Navigation
            activeSlug={activeSlug}
            onNavigate={navigate}
            user={user}
            onLogout={logout}
            moduleItems={runtimeModules}
          />
        </aside>

        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <SheetContent side="left" className="mobile-sheet">
            <SheetHeader className="sr-only">
              <SheetTitle>Navegación</SheetTitle>
              <SheetDescription>Módulos del sistema</SheetDescription>
            </SheetHeader>
            <Navigation
              activeSlug={activeSlug}
              onNavigate={navigate}
              user={user}
              onLogout={logout}
              moduleItems={runtimeModules}
            />
          </SheetContent>
        </Sheet>

      <div className="erp-main">
        <header className="topbar">
          <div className="topbar-leading">
            <button
              className="icon-button menu-button"
              aria-label="Abrir menú"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu size={21} />
            </button>
            <div className="page-identity">
              <span>{activeModule.group}</span>
              <strong>
                {selectedWork ? selectedWork.name : activeModule.label}
              </strong>
            </div>
          </div>
          <label className="global-search">
            <Search size={18} aria-hidden="true" />
            <input
              aria-label="Buscar en el ERP"
              placeholder="Buscar obra, expediente, proveedor…"
              value={globalSearch}
              onChange={(event) => setGlobalSearch(event.target.value)}
            />
            <kbd>⌘ K</kbd>
          </label>
          <div className="topbar-actions">
            <button className="icon-button notification-button" aria-label="Alertas">
              <Bell size={20} />
              <span />
            </button>
            <button className="user-pill" onClick={() => navigate("system")}>
              <span className="avatar">{user.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}</span>
              <span>
                <strong>{user.name}</strong>
                <small>{user.role}</small>
              </span>
              <ChevronDown size={16} />
            </button>
          </div>
        </header>

        <main className="content">
          {selectedWork ? (
            <WorkDashboard
              work={selectedWork}
              onBack={() => navigate("works")}
              onCreate={() => setCreateOpen(true)}
            />
          ) : activeSlug === "dashboard" ? (
            <GeneralDashboard
              onOpenWork={openWork}
              onNavigate={navigate}
              search={globalSearch}
              workItems={availableWorks}
            />
          ) : activeSlug === "works" ? (
            <WorksPage
              onOpenWork={openWork}
              onCreate={mayCreate ? () => setCreateOpen(true) : undefined}
              search={globalSearch}
              workItems={availableWorks}
            />
          ) : (
            <ModulePage
              module={activeModule}
              onCreate={mayCreate ? () => setCreateOpen(true) : undefined}
              onNavigate={navigate}
              search={globalSearch}
              user={user}
            />
          )}
        </main>
      </div>

        <QuickCreateDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          module={activeModule}
          workItems={availableWorks}
        />
      </div>
    </>
  );
}

function LandingPage({ onLogin }: { onLogin: () => void }) {
  const submitContact = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    toast.success("Consulta preparada", {
      description: "Conectá el correo corporativo antes de publicar el formulario definitivo.",
    });
  };

  return (
    <main className="institutional-site">
      <Toaster richColors position="top-right" />
      <header className="public-header">
        <a className="public-brand" href="#inicio" aria-label="Litoral NEA, inicio">
          <img src="/assets/litoral-nea-logo.png" alt="" />
          <span><strong>LITORAL NEA</strong><small>Ingeniería · Obras · Servicios</small></span>
        </a>
        <nav aria-label="Navegación institucional">
          <a href="#empresa">Empresa</a>
          <a href="#servicios">Servicios</a>
          <a href="#obras">Obras</a>
          <a href="#contacto">Contacto</a>
        </nav>
        <button className="public-login" type="button" onClick={onLogin}>
          Iniciar sesión <ArrowRight size={17} />
        </button>
      </header>

      <section className="public-hero" id="inicio">
        <img src="/assets/roadworks.webp" alt="Obra vial e infraestructura" />
        <div className="public-hero-shade" />
        <div className="public-hero-content">
          <span className="public-kicker">LITORAL NEA SRL</span>
          <h1>Infraestructura que<br />hace avanzar al NEA.</h1>
          <p>
            Integramos ingeniería, construcción y gestión para transformar
            proyectos públicos y privados en obras seguras, eficientes y duraderas.
          </p>
          <div className="public-hero-actions">
            <a className="public-primary" href="#servicios">
              Conocer servicios <ArrowDownLeft size={18} />
            </a>
            <a className="public-secondary" href="#contacto">Contactar</a>
          </div>
        </div>
        <div className="public-hero-proof">
          <span><strong>Obra pública</strong><small>Gestión contractual integral</small></span>
          <span><strong>Infraestructura</strong><small>Civil, eléctrica y sanitaria</small></span>
          <span><strong>Trazabilidad</strong><small>Control técnico y documental</small></span>
        </div>
      </section>

      <section className="public-about" id="empresa">
        <div className="public-section-intro">
          <span className="public-kicker dark">QUIÉNES SOMOS</span>
          <h2>Una empresa regional con visión integral.</h2>
        </div>
        <div className="public-about-copy">
          <p>
            LITORAL NEA SRL desarrolla y coordina obras de infraestructura con foco
            en calidad, planificación y cumplimiento. Unimos equipos técnicos y
            administrativos en una misma forma de trabajo.
          </p>
          <div className="public-checks">
            <span><CheckCircle2 size={18} /> Ingeniería y documentación coordinadas</span>
            <span><CheckCircle2 size={18} /> Seguimiento físico, económico y financiero</span>
            <span><CheckCircle2 size={18} /> Seguridad, calidad y responsabilidad operativa</span>
          </div>
        </div>
      </section>

      <section className="public-services" id="servicios">
        <div className="public-section-heading">
          <div><span className="public-kicker dark">QUÉ HACEMOS</span><h2>Capacidad técnica de punta a punta.</h2></div>
          <p>Soluciones articuladas desde el proyecto y el presupuesto hasta la ejecución, certificación y entrega.</p>
        </div>
        <div className="public-service-grid">
          {[
            [DraftingCompass, "Ingeniería", "Proyectos, memorias, cálculos, planos y dirección técnica."],
            [Building2, "Arquitectura", "Diseño, cómputos, documentación ejecutiva y seguimiento."],
            [Construction, "Obras civiles", "Pavimentos, desagües, estructuras y equipamiento urbano."],
            [Landmark, "Obra pública", "Licitaciones, contratos, certificados y gestión de expedientes."],
            [Fuel, "Infraestructura eléctrica", "Redes de media y baja tensión, montaje y mantenimiento."],
            [Wrench, "Servicios operativos", "Flota, maquinaria, logística y mantenimiento de activos."],
          ].map(([Icon, title, description], index) => {
            const ServiceIcon = Icon as LucideIcon;
            return (
              <article key={String(title)}>
                <span className="public-service-number">0{index + 1}</span>
                <ServiceIcon size={27} />
                <h3>{String(title)}</h3>
                <p>{String(description)}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="public-projects" id="obras">
        <div className="public-section-heading light">
          <div><span className="public-kicker">OBRAS Y PROYECTOS</span><h2>Experiencia en sectores esenciales.</h2></div>
          <p>Una muestra visual de las capacidades contempladas por la plataforma institucional.</p>
        </div>
        <div className="public-project-grid">
          {[
            ["/assets/roadworks.webp", "Infraestructura vial", "Pavimento, cordón cuneta y desagües urbanos"],
            ["/assets/electrical.webp", "Redes MT/BT", "Distribución eléctrica, montaje y puesta en servicio"],
            ["/assets/laboratory.webp", "Arquitectura institucional", "Salud, laboratorios y edificios de servicio"],
          ].map(([image, title, description]) => (
            <article key={title}>
              <img src={image} alt={title} />
              <div><small>ÁREA DE EXPERIENCIA</small><h3>{title}</h3><p>{description}</p></div>
            </article>
          ))}
        </div>
      </section>

      <section className="public-contact" id="contacto">
        <div className="public-contact-copy">
          <span className="public-kicker dark">CONTACTO</span>
          <h2>Conversemos sobre tu próximo proyecto.</h2>
          <p>Contanos el alcance y nuestro equipo podrá organizar una primera evaluación técnica.</p>
          <span className="public-location"><MapPin size={19} /> Región NEA · Argentina</span>
        </div>
        <form onSubmit={submitContact}>
          <label><span>Nombre y organización</span><input required maxLength={120} placeholder="Tu nombre" /></label>
          <label><span>Correo</span><input required type="email" maxLength={254} placeholder="nombre@empresa.com" /></label>
          <label><span>Consulta</span><textarea required maxLength={1500} rows={4} placeholder="Breve descripción del proyecto" /></label>
          <button type="submit">Enviar consulta <Mail size={17} /></button>
          <small>Formulario demostrativo: integrar el correo corporativo antes del uso público.</small>
        </form>
      </section>

      <footer className="public-footer">
        <div className="public-brand inverse">
          <img src="/assets/litoral-nea-logo.png" alt="" />
          <span><strong>LITORAL NEA</strong><small>Ingeniería · Obras · Servicios</small></span>
        </div>
        <p>© 2026 LITORAL NEA SRL · Todos los derechos reservados.</p>
        <button type="button" onClick={onLogin}>Acceso al ERP <ArrowUpRight size={16} /></button>
      </footer>
    </main>
  );
}

function LoginScreen({
  onLogin,
  onBack,
  oauthMessage,
}: {
  onLogin: (user: DemoUser) => void;
  onBack: () => void;
  oauthMessage?: string;
}) {
  const [username, setUsername] = useState("admin@litoralnea.com");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [showDemoUsers, setShowDemoUsers] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [recovery, setRecovery] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (recovery) {
        if (!username.includes("@")) throw new Error("Ingresá un correo válido.");
        if (!demoMode && apiUrl) {
          await apiFetch("/auth/forgot-password", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: username }),
          });
        }
        setRecovery(false);
        setError(
          "Solicitud registrada. Si el usuario existe, recibirá instrucciones.",
        );
        return;
      }

      if (demoMode) {
        await new Promise((resolve) => window.setTimeout(resolve, 450));
        const account = findDemoAccount(username, password);
        if (!account) {
          throw new Error("Usuario o contraseña incorrectos.");
        }
        onLogin(account);
        return;
      }

      const response = await apiFetch("/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (!response.ok) {
        const problem = (await response.json().catch(() => null)) as
          | { message?: string | string[]; code?: string }
          | null;
        const detail = Array.isArray(problem?.message)
          ? problem?.message.join(". ")
          : problem?.message;
        throw new Error(
          detail
            ? `${response.status} · ${detail}`
            : `${response.status} · No se pudo autenticar contra la API.`,
        );
      }
      const payload = (await response.json()) as {
        user: { firstName: string; lastName: string; email: string; roleCodes: string[] };
        csrfToken?: string;
      };
      if (payload.csrfToken) csrfTokenCache = payload.csrfToken;
      const accessProfile = profileForRoleCodes(payload.user.roleCodes);
      onLogin({
        ...accessProfile,
        name: `${payload.user.firstName} ${payload.user.lastName}`,
        email: payload.user.email,
        role: payload.user.roleCodes.join(" · "),
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo ingresar.");
    } finally {
      setLoading(false);
    }
  };

  const startOAuth = (provider: "google" | "microsoft") => {
    if (demoMode || !apiUrl) {
      setError(
        `Acceso con ${provider === "google" ? "Google" : "Microsoft/Hotmail"} preparado; requiere configurar las credenciales OAuth del servidor.`,
      );
      return;
    }
    window.location.assign(`${apiUrl}/auth/oauth/${provider}/start`);
  };

  return (
    <main className="login-page">
      <section className="login-visual">
        <div className="login-visual-overlay" />
        <div className="login-brand-lockup">
          <img src="/assets/litoral-nea-logo.png" alt="Litoral NEA" />
          <div>
            <span>Plataforma corporativa</span>
            <h1>Control integral,<br />obra por obra.</h1>
          </div>
        </div>
        <div className="login-proof">
          <div>
            <ShieldCheck size={22} />
            <span><strong>Auditable</strong><small>Trazabilidad completa</small></span>
          </div>
          <div>
            <Building2 size={22} />
            <span><strong>8 obras</strong><small>Gestión simultánea</small></span>
          </div>
          <div>
            <CircleDollarSign size={22} />
            <span><strong>$1.240 M</strong><small>Contratos activos</small></span>
          </div>
        </div>
      </section>

      <section className="login-panel">
        <div className="login-card">
          <button className="login-back" type="button" onClick={onBack}>
            <ArrowLeft size={17} /> Volver al sitio
          </button>
          <div className="login-mobile-logo">
            <img src="/assets/litoral-nea-logo.png" alt="Litoral NEA" />
          </div>
          <div className="login-heading">
            <span className="eyebrow">LITORAL NEA ERP</span>
            <h2>{recovery ? "Recuperar acceso" : "Bienvenido"}</h2>
            <p>
              {recovery
                ? "Ingresá el correo asociado a tu usuario."
                : "Ingresá con tus credenciales corporativas."}
            </p>
          </div>
          <form onSubmit={submit}>
            <label className="form-field">
              <span>{recovery ? "Correo" : "Usuario"}</span>
              <input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                autoComplete="username"
                placeholder="usuario@litoralnea.com"
              />
            </label>
            {!recovery && (
              <label className="form-field">
                <span>Contraseña</span>
                <div className="password-input">
                  <input
                    type={visible ? "text" : "password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
                    onClick={() => setVisible(!visible)}
                  >
                    {visible ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </label>
            )}
            <div className="login-options">
              {!recovery && (
                <label className="check-row">
                  <input type="checkbox" />
                  <span>Recordar este equipo</span>
                </label>
              )}
              <button
                type="button"
                className="text-button"
                onClick={() => {
                  setRecovery(!recovery);
                  setError("");
                }}
              >
                {recovery ? "Volver al ingreso" : "¿Olvidaste la contraseña?"}
              </button>
            </div>
            {error && (
              <div
                className={error.startsWith("Solicitud") ? "login-message ok" : "login-message"}
                role="status"
              >
                {error}
              </div>
            )}
            {!error && oauthMessage && (
              <div className="login-message ok" role="status">
                {oauthMessage}
              </div>
            )}
            <button className="login-submit" disabled={loading}>
              {loading ? "Procesando…" : recovery ? "Enviar instrucciones" : "Ingresar al sistema"}
              {!loading && <ArrowRight size={18} />}
            </button>
          </form>
          {!recovery && (
            <div className="oauth-access">
              <span>o continuar con</span>
              <div>
                <button type="button" onClick={() => startOAuth("google")}>
                  <strong>G</strong> Google
                </button>
                <button type="button" onClick={() => startOAuth("microsoft")}>
                  <i aria-hidden="true"><b /><b /><b /><b /></i> Microsoft / Hotmail
                </button>
              </div>
              <small>El primer acceso requiere aprobación del Administrador General.</small>
            </div>
          )}
          {demoMode && !recovery && (
            <div className="demo-users-box">
              <button
                className="demo-users-toggle"
                type="button"
                onClick={() => setShowDemoUsers((value) => !value)}
              >
                <span>Usuarios de demostración</span>
                <ChevronDown size={16} className={showDemoUsers ? "rotated" : ""} />
              </button>
              {showDemoUsers && (
                <div className="demo-user-list">
                  {demoAccounts.map((account) => (
                    <button
                      type="button"
                      key={account.username}
                      onClick={() => {
                        setUsername(account.username);
                        setPassword(account.password);
                        setShowDemoUsers(false);
                      }}
                    >
                      <span><strong>{account.username}</strong><small>{account.role}</small></span>
                      <code>{account.password}</code>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          <div className="login-security">
            <ShieldCheck size={17} />
            Sesión protegida · MFA preparado · Auditoría activa
          </div>
        </div>
        <footer>© 2026 LITORAL NEA SRL · Uso corporativo</footer>
      </section>
    </main>
  );
}

function Navigation({
  activeSlug,
  onNavigate,
  user,
  onLogout,
  moduleItems,
}: {
  activeSlug: string;
  onNavigate: (slug: string) => void;
  user: DemoUser;
  onLogout: () => void;
  moduleItems: ModuleDefinition[];
}) {
  const [filter, setFilter] = useState("");
  const visibleModules = moduleItems.filter(
    (module) =>
      canUseModule(user, module.slug) &&
      `${module.label} ${module.summary}`.toLowerCase().includes(filter.toLowerCase()),
  );

  return (
    <div className="navigation">
      <div className="sidebar-brand">
        <img src="/assets/litoral-nea-logo.png" alt="" />
        <div>
          <strong>LITORAL NEA</strong>
          <span>ERP EMPRESARIAL</span>
        </div>
      </div>
      <label className="sidebar-search">
        <Search size={16} />
        <input
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          placeholder="Filtrar módulos"
          aria-label="Filtrar módulos"
        />
      </label>
      <nav className="sidebar-nav" aria-label="Módulos">
        {[...new Set(moduleItems.map((module) => module.group))].map((group) => {
          const groupModules = visibleModules.filter(
            (module) => module.group === group,
          );
          if (!groupModules.length) return null;
          return (
            <div className="nav-group" key={group}>
              <span className="nav-group-label">{group}</span>
              {groupModules.map((module) => {
                const Icon = iconMap[module.icon] ?? Settings;
                return (
                  <button
                    key={module.slug}
                    className={activeSlug === module.slug ? "nav-item active" : "nav-item"}
                    onClick={() => onNavigate(module.slug)}
                  >
                    <Icon size={18} strokeWidth={1.8} />
                    <span>{module.label}</span>
                    {module.slug === "approvals" && <em>4</em>}
                  </button>
                );
              })}
            </div>
          );
        })}
      </nav>
      <div className="sidebar-footer">
        <div className="sidebar-user">
          <span className="avatar">{user.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}</span>
          <span>
            <strong>{user.name}</strong>
            <small>{user.role}</small>
          </span>
        </div>
        <button onClick={onLogout} aria-label="Cerrar sesión">
          <LogOut size={18} />
        </button>
      </div>
    </div>
  );
}

function PageHeader({
  eyebrow,
  title,
  description,
  onCreate,
  createLabel = "Nuevo registro",
}: {
  eyebrow?: string;
  title: string;
  description: string;
  onCreate?: () => void;
  createLabel?: string;
}) {
  return (
    <div className="page-header">
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      <div className="header-actions">
        <button
          className="button secondary"
          onClick={() => {
            const blob = new Blob(["LITORAL NEA ERP\nReporte demo\n"], {
              type: "text/csv;charset=utf-8",
            });
            const link = document.createElement("a");
            link.href = URL.createObjectURL(blob);
            link.download = "litoral-nea-reporte-demo.csv";
            link.click();
            URL.revokeObjectURL(link.href);
            toast.success("Reporte exportado");
          }}
        >
          <Download size={17} />
          Exportar
        </button>
        {onCreate && (
          <button className="button primary" onClick={onCreate}>
            <Plus size={18} />
            {createLabel}
          </button>
        )}
      </div>
    </div>
  );
}

function GeneralDashboard({
  onOpenWork,
  onNavigate,
  search,
  workItems,
}: {
  onOpenWork: (work: Work) => void;
  onNavigate: (slug: string) => void;
  search: string;
  workItems: Work[];
}) {
  const filteredWorks = workItems.filter((work) =>
    `${work.code} ${work.name} ${work.client}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  return (
    <>
      <PageHeader
        eyebrow="VIERNES · 04 SEP 2026"
        title="Panel general"
        description="Situación consolidada de LITORAL NEA SRL."
      />

      <section className="kpi-grid" aria-label="Indicadores principales">
        <KpiCard
          tone="cyan"
          icon={HardHat}
          label="Obras activas"
          value="8"
          detail="Sin límite configurado"
          trend="+2 este trimestre"
        />
        <KpiCard
          tone="orange"
          icon={CircleDollarSign}
          label="Contratos vigentes"
          value="$1.240 M"
          detail="Presupuesto objetivo $1.027 M"
          trend="Margen est. 15,9%"
        />
        <KpiCard
          tone="blue"
          icon={ArrowDownLeft}
          label="Pendiente de cobro"
          value="$145 M"
          detail="3 certificados en trámite"
          trend="17 días promedio"
        />
        <KpiCard
          tone="dark"
          icon={WalletCards}
          label="Caja + bancos"
          value="$124 M"
          detail="Saldo contable consolidado"
          trend="+$34 M vs. agosto"
        />
      </section>

      <section className="dashboard-grid">
        <article className="panel works-overview">
          <div className="panel-heading">
            <div>
              <span className="panel-kicker">Control de gestión</span>
              <h2>Estado de obras</h2>
            </div>
            <button className="link-button" onClick={() => onNavigate("works")}>
              Ver las 8 obras <ArrowRight size={16} />
            </button>
          </div>
          <Table className="erp-table">
            <TableHeader>
              <TableRow>
                <TableHead>Obra</TableHead>
                <TableHead>Avance físico</TableHead>
                <TableHead>Financiero</TableHead>
                <TableHead>Margen</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredWorks.slice(0, 5).map((work) => (
                <TableRow
                  key={work.id}
                  className="clickable-row"
                  onClick={() => onOpenWork(work)}
                >
                  <TableCell>
                    <span className="table-primary">{work.name}</span>
                    <small>{work.code} · {work.city}</small>
                  </TableCell>
                  <TableCell>
                    <div className="progress-cell">
                      <Progress value={work.physicalProgress} />
                      <span>{work.physicalProgress}%</span>
                    </div>
                  </TableCell>
                  <TableCell>{work.financialProgress}%</TableCell>
                  <TableCell className={work.margin < 10 ? "warning-text" : "positive-text"}>
                    {percent(work.margin)}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={work.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </article>

        <article className="panel alert-panel">
          <div className="panel-heading">
            <div>
              <span className="panel-kicker orange">Prioridad</span>
              <h2>Alertas</h2>
            </div>
            <button className="icon-button"><SlidersHorizontal size={17} /></button>
          </div>
          <div className="alert-list">
            {alerts.map((alert) => (
              <button
                className="alert-row"
                key={alert.title}
                onClick={() => toast.info(alert.detail)}
              >
                <span className={`alert-dot ${alert.level}`} />
                <span>
                  <strong>{alert.title}</strong>
                  <small>{alert.detail}</small>
                </span>
                <ArrowRight size={16} />
              </button>
            ))}
          </div>
          <button className="panel-footer-link" onClick={() => onNavigate("management")}>
            Abrir centro de alertas
          </button>
        </article>
      </section>

      <section className="dashboard-grid lower">
        <article className="panel cashflow-panel">
          <div className="panel-heading">
            <div>
              <span className="panel-kicker">Últimos 6 meses</span>
              <h2>Flujo de fondos</h2>
            </div>
            <div className="legend">
              <span><i className="income" /> Ingresos</span>
              <span><i className="expense" /> Egresos</span>
            </div>
          </div>
          <div className="cashflow-chart" aria-label="Ingresos y egresos en millones">
            {cashflow.map((row) => (
              <div className="cashflow-column" key={row.month}>
                <div className="bar-pair">
                  <span className="income" style={{ height: `${row.income}%` }} />
                  <span className="expense" style={{ height: `${row.expense}%` }} />
                </div>
                <small>{row.month}</small>
              </div>
            ))}
          </div>
          <div className="cashflow-summary">
            <span><small>Ingresos proyectados</small><strong>$112 M</strong></span>
            <span><small>Egresos proyectados</small><strong>$78 M</strong></span>
            <span><small>Saldo proyectado</small><strong className="positive-text">+$34 M</strong></span>
          </div>
        </article>

        <article className="panel activity-panel">
          <div className="panel-heading">
            <div>
              <span className="panel-kicker">Auditoría</span>
              <h2>Actividad reciente</h2>
            </div>
          </div>
          <div className="activity-list">
            {activity.map((item, index) => (
              <div className="activity-row" key={item.action}>
                <span className="activity-avatar">{item.user.split(" ").map((part) => part[0]).join("")}</span>
                <span>
                  <strong>{item.user}</strong>
                  <p>{item.action}</p>
                  <small>{item.module} · {item.time}</small>
                </span>
                {index === 0 && <span className="live-dot" />}
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="sector-strip">
        <button onClick={() => onNavigate("progress")} className="sector-card roads">
          <span>Obras civiles</span><strong>3 frentes activos</strong><ArrowUpRight size={18} />
        </button>
        <button onClick={() => onNavigate("engineering")} className="sector-card electric">
          <span>Infraestructura eléctrica</span><strong>2 proyectos MT/BT</strong><ArrowUpRight size={18} />
        </button>
        <button onClick={() => onNavigate("architecture")} className="sector-card interiors">
          <span>Arquitectura e instalaciones</span><strong>3 obras activas</strong><ArrowUpRight size={18} />
        </button>
      </section>
    </>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  detail,
  trend,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  detail: string;
  trend: string;
  tone: string;
}) {
  return (
    <article className={`kpi-card ${tone}`}>
      <div className="kpi-top">
        <span className="kpi-icon"><Icon size={21} /></span>
        <span className="kpi-trend">{trend}</span>
      </div>
      <p>{label}</p>
      <strong className="kpi-value">{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

function WorksPage({
  onOpenWork,
  onCreate,
  search,
  workItems,
}: {
  onOpenWork: (work: Work) => void;
  onCreate?: () => void;
  search: string;
  workItems: Work[];
}) {
  const [status, setStatus] = useState("Todas");
  const filtered = workItems.filter(
    (work) =>
      (status === "Todas" || work.status === status) &&
      `${work.name} ${work.code} ${work.client} ${work.city}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  return (
    <>
      <PageHeader
        eyebrow="OPERACIÓN"
        title="Obras activas"
        description="Control contractual, físico y financiero por centro de costo."
        onCreate={onCreate}
        createLabel="Nueva obra"
      />
      <div className="view-toolbar">
        <div className="segmented">
          {["Todas", "Normal", "Atención"].map((item) => (
            <button
              key={item}
              className={status === item ? "active" : ""}
              onClick={() => setStatus(item)}
            >
              {item}
              <span>
                {item === "Todas"
                  ? workItems.length
                  : workItems.filter((work) => work.status === item).length}
              </span>
            </button>
          ))}
        </div>
        <button className="button secondary"><Filter size={17} /> Más filtros</button>
      </div>
      <section className="work-card-grid">
        {filtered.map((work) => (
          <button className="work-card" key={work.id} onClick={() => onOpenWork(work)}>
            <div className="work-card-image">
              <img src={work.image} alt="" />
              <span>{work.code}</span>
              <StatusBadge status={work.status} />
            </div>
            <div className="work-card-body">
              <small>{work.client}</small>
              <h2>{work.name}</h2>
              <p><MapPinned size={15} /> {work.city}, Corrientes</p>
              <div className="work-card-amounts">
                <span><small>Contrato</small><strong>{money(work.contractAmount, true)}</strong></span>
                <span><small>Costo real</small><strong>{money(work.actualCost, true)}</strong></span>
                <span><small>Margen</small><strong className={work.margin < 10 ? "warning-text" : "positive-text"}>{percent(work.margin)}</strong></span>
              </div>
              <div className="work-progress">
                <span><small>Avance físico</small><strong>{work.physicalProgress}%</strong></span>
                <Progress value={work.physicalProgress} />
              </div>
              <div className="work-card-footer">
                <span className="mini-avatar">{work.responsible.split(" ").slice(-1)[0][0]}</span>
                <span>{work.responsible}</span>
                <ArrowRight size={17} />
              </div>
            </div>
          </button>
        ))}
      </section>
    </>
  );
}

function WorkDashboard({
  work,
  onBack,
  onCreate,
}: {
  work: Work;
  onBack: () => void;
  onCreate: () => void;
}) {
  const [tab, setTab] = useState("Resumen");
  const billed = work.contractAmount * (work.financialProgress / 100);
  return (
    <>
      <button className="back-link" onClick={onBack}><ArrowLeft size={17} /> Volver a obras</button>
      <section className="work-hero">
        <img src={work.image} alt="" />
        <div className="work-hero-overlay" />
        <div className="work-hero-content">
          <div>
            <span className="work-code">{work.code}</span>
            <h1>{work.name}</h1>
            <p>{work.client} · {work.city}, Corrientes</p>
          </div>
          <div className="hero-actions">
            <button className="button glass"><Upload size={17} /> Adjuntar</button>
            <button className="button orange" onClick={onCreate}><Plus size={17} /> Nuevo parte</button>
          </div>
        </div>
        <div className="work-hero-meta">
          <span><small>Responsable</small><strong>{work.responsible}</strong></span>
          <span><small>Contrato</small><strong>{money(work.contractAmount, true)}</strong></span>
          <span><small>Estado</small><StatusBadge status={work.status} /></span>
        </div>
      </section>

      <div className="work-tabs" role="tablist">
        {["Resumen", "Avance", "Presupuesto", "Certificados", "Compras", "Personal", "Documentos"].map((item) => (
          <button
            role="tab"
            aria-selected={tab === item}
            className={tab === item ? "active" : ""}
            key={item}
            onClick={() => setTab(item)}
          >
            {item}
          </button>
        ))}
      </div>

      {tab !== "Resumen" ? (
        <article className="panel tab-placeholder">
          <span className="feature-icon"><FileCheck2 size={24} /></span>
          <h2>{tab}</h2>
          <p>Vista vinculada a {work.code}. Los movimientos conservan obra, centro de costo, usuario y fecha.</p>
          <button className="button primary" onClick={onCreate}><Plus size={17} /> Agregar registro</button>
        </article>
      ) : (
        <>
          <section className="kpi-grid work-kpis">
            <MetricCard label="Presupuesto objetivo" value={money(work.targetBudget, true)} detail="Base aprobada v3" />
            <MetricCard label="Costo real" value={money(work.actualCost, true)} detail="Actualizado hoy" />
            <MetricCard label="Facturado" value={money(billed, true)} detail={`${work.financialProgress}% financiero`} />
            <MetricCard label="Margen proyectado" value={percent(work.margin)} detail={money(work.contractAmount - work.actualCost, true)} tone={work.margin < 10 ? "warning" : "positive"} />
          </section>
          <section className="work-detail-grid">
            <article className="panel progress-panel">
              <div className="panel-heading">
                <div><span className="panel-kicker">Situación</span><h2>Avance y plazo</h2></div>
                <span className="updated">Actualizado hoy</span>
              </div>
              <div className="radial-row">
                <div className="radial" style={{ "--value": `${work.physicalProgress * 3.6}deg` } as React.CSSProperties}>
                  <span><strong>{work.physicalProgress}%</strong><small>Físico</small></span>
                </div>
                <div className="progress-breakdown">
                  <div><span><i className="cyan" /> Avance físico</span><strong>{work.physicalProgress}%</strong></div>
                  <Progress value={work.physicalProgress} />
                  <div><span><i className="orange" /> Avance financiero</span><strong>{work.financialProgress}%</strong></div>
                  <Progress value={work.financialProgress} className="orange-progress" />
                  <div><span><i className="dark" /> Plazo consumido</span><strong>64%</strong></div>
                  <Progress value={64} className="dark-progress" />
                </div>
              </div>
              <div className="deadline">
                <CalendarDays size={19} />
                <span><small>Fin contractual</small><strong>28 de marzo de 2027</strong></span>
                <span className="days-left">205 días restantes</span>
              </div>
            </article>
            <article className="panel work-alerts">
              <div className="panel-heading"><div><span className="panel-kicker orange">Seguimiento</span><h2>Alertas de la obra</h2></div></div>
              {alerts.slice(0, 3).map((alert, index) => (
                <div className="compact-alert" key={alert.title}>
                  <span className={`alert-index ${alert.level}`}>{index + 1}</span>
                  <span><strong>{alert.title}</strong><small>{alert.detail}</small></span>
                </div>
              ))}
            </article>
          </section>
          <section className="dashboard-grid lower">
            <article className="panel">
              <div className="panel-heading"><div><span className="panel-kicker">Costos</span><h2>Distribución acumulada</h2></div></div>
              <div className="cost-list">
                {[
                  ["Materiales", 43, 62_100_000],
                  ["Mano de obra", 27, 38_980_000],
                  ["Equipos y combustible", 18, 25_980_000],
                  ["Subcontratos", 12, 17_298_000],
                ].map(([label, value, total]) => (
                  <div key={String(label)}>
                    <span><strong>{label}</strong><small>{money(Number(total), true)}</small></span>
                    <div className="cost-track"><i style={{ width: `${value}%` }} /></div>
                  </div>
                ))}
              </div>
            </article>
            <article className="panel">
              <div className="panel-heading"><div><span className="panel-kicker">Documentación</span><h2>Últimos archivos</h2></div><button className="link-button">Ver todos</button></div>
              <div className="document-list">
                {[
                  ["PDF", "Acta de inspección Nº 08", "v2 · hoy, 10:42"],
                  ["XLSX", "Certificado mensual Nº 4", "v5 · ayer"],
                  ["DWG", "Plano conforme a obra", "v3 · 02 sep"],
                ].map(([type, title, date]) => (
                  <button key={title} onClick={() => toast.info(`${title} · descarga demo`)}>
                    <span className={`file-type ${type.toLowerCase()}`}>{type}</span>
                    <span><strong>{title}</strong><small>{date}</small></span>
                    <Download size={17} />
                  </button>
                ))}
              </div>
            </article>
          </section>
        </>
      )}
    </>
  );
}

function MetricCard({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  tone?: "positive" | "warning";
}) {
  return (
    <article className="metric-card">
      <p>{label}</p>
      <strong className={tone === "positive" ? "positive-text" : tone === "warning" ? "warning-text" : ""}>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

type SectorDashboardCard = {
  key: string;
  label: string;
  value: number;
  format: "number" | "currency" | "percent" | "liters";
  tone?: "positive" | "warning" | "danger";
};

type SectorDashboardPayload = {
  module: string;
  generatedAt: string;
  authorized: boolean;
  cards: SectorDashboardCard[];
  alerts: Array<{
    id: string;
    severity: string;
    title: string;
    description?: string | null;
    dueAt?: string | null;
    workCode?: string | null;
    workName?: string | null;
  }>;
  byWork: Array<{
    workId?: string | null;
    code: string;
    name: string;
    count: number;
    amount: number;
  }>;
};

const formatSectorValue = (card: SectorDashboardCard) => {
  if (card.format === "currency") return money(card.value, card.value >= 1_000_000);
  if (card.format === "percent") return percent(card.value);
  if (card.format === "liters") {
    return `${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 }).format(card.value)} L`;
  }
  return new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 }).format(card.value);
};

function SectorDashboardPanel({ module }: { module: ModuleDefinition }) {
  const [data, setData] = useState<SectorDashboardPayload | null>(null);
  const [loading, setLoading] = useState(!demoMode);

  useEffect(() => {
    if (demoMode) return;
    const controller = new AbortController();
    setLoading(true);
    void apiFetch(`/dashboard/sector/${module.slug}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("No se pudo cargar el tablero sectorial");
        return response.json() as Promise<SectorDashboardPayload>;
      })
      .then((payload) => setData(payload))
      .catch((cause) => {
        if ((cause as { name?: string }).name !== "AbortError") {
          toast.error("No se cargó el dashboard del sector", {
            description: cause instanceof Error ? cause.message : "Error de conexión",
          });
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [module.slug]);

  if (demoMode) {
    return (
      <section className="sector-dashboard-shell">
        <div className="sector-dashboard-heading">
          <div>
            <span className="panel-kicker">Tablero sectorial</span>
            <h2>{module.label}</h2>
          </div>
          <small>Modo demostración</small>
        </div>
        <div className="sector-kpi-grid">
          <article><small>Registros</small><strong>—</strong><p>Conectar API para datos reales</p></article>
          <article><small>Pendientes</small><strong>—</strong><p>Sin datos productivos</p></article>
          <article><small>Actividad 30 días</small><strong>—</strong><p>Sin datos productivos</p></article>
          <article><small>Documentos</small><strong>—</strong><p>Sin datos productivos</p></article>
        </div>
      </section>
    );
  }

  return (
    <section className="sector-dashboard-shell">
      <div className="sector-dashboard-heading">
        <div>
          <span className="panel-kicker">Tablero sectorial</span>
          <h2>Control de {module.label}</h2>
        </div>
        <small>
          {loading
            ? "Actualizando…"
            : data?.generatedAt
              ? `Corte ${new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short" }).format(new Date(data.generatedAt))}`
              : "Sin datos"}
        </small>
      </div>

      {!data?.authorized && !loading ? (
        <div className="sector-dashboard-empty">El perfil actual no tiene autorización para consultar este tablero.</div>
      ) : (
        <>
          <div className="sector-kpi-grid">
            {(data?.cards ?? []).map((card) => (
              <article className={card.tone ? `tone-${card.tone}` : ""} key={card.key}>
                <small>{card.label}</small>
                <strong>{formatSectorValue(card)}</strong>
                <p>{card.tone === "danger" ? "Requiere intervención" : card.tone === "warning" ? "Revisar pendiente" : "Dato consolidado"}</p>
              </article>
            ))}
            {loading && Array.from({ length: 6 }).map((_, index) => (
              <article className="sector-kpi-loading" key={index}>
                <small>Cargando indicador</small>
                <strong>…</strong>
                <p>Consultando base de datos</p>
              </article>
            ))}
          </div>

          {(data?.byWork.length || data?.alerts.length) ? (
            <div className="sector-dashboard-detail">
              <article className="panel">
                <div className="panel-heading">
                  <div><span className="panel-kicker">Centros de costo</span><h2>Distribución por obra</h2></div>
                </div>
                <div className="sector-work-list">
                  {data?.byWork.length ? data.byWork.map((row) => (
                    <div key={row.workId ?? row.code}>
                      <span><strong>{row.code}</strong><small>{row.name}</small></span>
                      <span><strong>{row.amount ? money(row.amount, true) : `${row.count} reg.`}</strong><small>{row.count} registros</small></span>
                    </div>
                  )) : <p className="sector-dashboard-empty">Todavía no hay movimientos imputados por obra.</p>}
                </div>
              </article>
              <article className="panel">
                <div className="panel-heading">
                  <div><span className="panel-kicker orange">Control</span><h2>Alertas del sector</h2></div>
                </div>
                <div className="sector-alert-list">
                  {data?.alerts.length ? data.alerts.map((alert) => (
                    <div key={alert.id}>
                      <i className={alert.severity.toLowerCase()} />
                      <span>
                        <strong>{alert.title}</strong>
                        <small>{[alert.workCode, alert.description].filter(Boolean).join(" · ")}</small>
                      </span>
                    </div>
                  )) : <p className="sector-dashboard-empty">Sin alertas abiertas para este sector.</p>}
                </div>
              </article>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}

type TechnicalWorkspacePayload = {
  generatedAt: string;
  summary: {
    assignedTasks: number;
    inProgress: number;
    overdue: number;
    unexpectedOpen: number;
    activeWorks: number;
    unreadNotifications: number;
  };
  tasks: Array<{
    id: string;
    code: string;
    title: string;
    discipline: string;
    taskType: string;
    priority: string;
    status: string;
    dueAt?: string | null;
    progressPct: string | number;
    work?: { code: string; name: string } | null;
  }>;
  unexpectedTasks: Array<{
    id: string;
    code: string;
    title: string;
    priority: string;
    status: string;
    dueAt?: string | null;
    work?: { code: string; name: string } | null;
  }>;
  works: Array<{
    id: string;
    code: string;
    name: string;
    status: string;
    city?: string | null;
    physicalProgress: string | number;
    contractualEndDate?: string | null;
  }>;
  notifications: Array<{
    id: string;
    title: string;
    message: string;
    severity: string;
    createdAt: string;
  }>;
};

function TechnicalWorkspaceLivePanel() {
  const [payload, setPayload] = useState<TechnicalWorkspacePayload | null>(null);
  const [loading, setLoading] = useState(!demoMode);

  const load = () => {
    if (demoMode) return;
    setLoading(true);
    void apiFetch("/workspace/technical")
      .then(async (response) => {
        if (!response.ok) throw new Error("No se pudo cargar la bandeja técnica");
        return response.json() as Promise<TechnicalWorkspacePayload>;
      })
      .then(setPayload)
      .catch((cause) => toast.error("Bandeja técnica no disponible", {
        description: cause instanceof Error ? cause.message : "Error de conexión",
      }))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const setTaskStatus = async (id: string, status: "ACTIVE" | "CLOSED") => {
    const response = await apiFetch(`/workspace/technical/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, progressPct: status === "CLOSED" ? 100 : undefined }),
    });
    if (!response.ok) {
      const problem = (await response.json().catch(() => null)) as { message?: string } | null;
      toast.error("No se pudo actualizar la tarea", { description: problem?.message });
      return;
    }
    toast.success(status === "CLOSED" ? "Tarea finalizada" : "Tarea iniciada");
    load();
  };

  if (demoMode) return null;

  return (
    <section className="technical-workspace-live">
      <div className="technical-summary-strip">
        <article><small>Asignadas</small><strong>{payload?.summary.assignedTasks ?? "—"}</strong></article>
        <article><small>En ejecución</small><strong>{payload?.summary.inProgress ?? "—"}</strong></article>
        <article><small>Vencidas</small><strong>{payload?.summary.overdue ?? "—"}</strong></article>
        <article><small>Imprevistos</small><strong>{payload?.summary.unexpectedOpen ?? "—"}</strong></article>
        <article><small>Obras asignadas</small><strong>{payload?.summary.activeWorks ?? "—"}</strong></article>
        <article><small>Avisos sin leer</small><strong>{payload?.summary.unreadNotifications ?? "—"}</strong></article>
      </div>
      <div className="technical-workspace-grid">
        <article className="panel">
          <div className="panel-heading">
            <div><span className="panel-kicker">Mi agenda</span><h2>Tareas técnicas asignadas</h2></div>
            <small>{loading ? "Actualizando…" : `${payload?.tasks.length ?? 0} tareas`}</small>
          </div>
          <div className="technical-task-list">
            {payload?.tasks.length ? payload.tasks.map((task) => (
              <div key={task.id}>
                <span className={`technical-priority ${task.priority.toLowerCase()}`} />
                <span className="technical-task-copy">
                  <strong>{task.code} · {task.title}</strong>
                  <small>
                    {[task.work?.code, task.discipline, task.taskType, task.dueAt ? `vence ${new Intl.DateTimeFormat("es-AR").format(new Date(task.dueAt))}` : null]
                      .filter(Boolean).join(" · ")}
                  </small>
                </span>
                <span className="technical-task-progress">{Number(task.progressPct)}%</span>
                <span className="technical-task-actions">
                  {task.status !== "ACTIVE" && task.status !== "CLOSED" && (
                    <button className="button secondary" onClick={() => void setTaskStatus(task.id, "ACTIVE")}>Iniciar</button>
                  )}
                  {task.status !== "CLOSED" && (
                    <button className="button primary" onClick={() => void setTaskStatus(task.id, "CLOSED")}>Finalizar</button>
                  )}
                </span>
              </div>
            )) : <p className="sector-dashboard-empty">No hay tareas técnicas asignadas.</p>}
          </div>
        </article>

        <article className="panel">
          <div className="panel-heading">
            <div><span className="panel-kicker orange">Campo</span><h2>Imprevistos abiertos</h2></div>
          </div>
          <div className="technical-task-list compact">
            {payload?.unexpectedTasks.length ? payload.unexpectedTasks.map((task) => (
              <div key={task.id}>
                <span className={`technical-priority ${task.priority.toLowerCase()}`} />
                <span className="technical-task-copy">
                  <strong>{task.code} · {task.title}</strong>
                  <small>{[task.work?.code, task.status, task.dueAt ? new Intl.DateTimeFormat("es-AR").format(new Date(task.dueAt)) : null].filter(Boolean).join(" · ")}</small>
                </span>
              </div>
            )) : <p className="sector-dashboard-empty">Sin trabajos imprevistos asignados.</p>}
          </div>
        </article>
      </div>
    </section>
  );
}

type NotificationRow = {
  id: string;
  title: string;
  message: string;
  severity: string;
  module?: string | null;
  readAt?: string | null;
  createdAt: string;
  deliveries?: Array<{ channel: string; status: string }>;
};

function NotificationCenterLivePanel() {
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(!demoMode);

  const load = () => {
    if (demoMode) return;
    setLoading(true);
    void apiFetch("/workspace/notifications")
      .then(async (response) => {
        if (!response.ok) throw new Error("No se pudieron cargar las notificaciones");
        return response.json() as Promise<NotificationRow[]>;
      })
      .then(setItems)
      .catch((cause) => toast.error("Notificaciones no disponibles", {
        description: cause instanceof Error ? cause.message : "Error de conexión",
      }))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const markRead = async (id: string) => {
    const response = await apiFetch(`/workspace/notifications/${id}/read`, { method: "PATCH" });
    if (response.ok) load();
  };

  if (demoMode) return null;

  return (
    <section className="panel notification-center-live">
      <div className="panel-heading">
        <div><span className="panel-kicker">Centro de avisos</span><h2>Notificaciones del usuario</h2></div>
        <small>{loading ? "Actualizando…" : `${items.filter((item) => !item.readAt).length} sin leer`}</small>
      </div>
      <div className="notification-live-list">
        {items.length ? items.map((item) => (
          <div className={item.readAt ? "read" : ""} key={item.id}>
            <i className={item.severity.toLowerCase()} />
            <span>
              <strong>{item.title}</strong>
              <small>{item.message}</small>
              <em>
                {new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short" }).format(new Date(item.createdAt))}
                {item.deliveries?.length
                  ? ` · ${item.deliveries.map((delivery) => `${delivery.channel}: ${delivery.status}`).join(" · ")}`
                  : ""}
              </em>
            </span>
            {!item.readAt && <button className="button secondary" onClick={() => void markRead(item.id)}>Marcar leída</button>}
          </div>
        )) : <p className="sector-dashboard-empty">No hay notificaciones.</p>}
      </div>
    </section>
  );
}

function ModulePage({
  module,
  onCreate,
  onNavigate,
  search,
  user,
}: {
  module: ModuleDefinition;
  onCreate?: () => void;
  onNavigate: (slug: string) => void;
  search: string;
  user: DemoUser;
}) {
  const Icon = iconMap[module.icon] ?? Settings;
  const [localSearch, setLocalSearch] = useState("");
  const [apiRows, setApiRows] = useState<Array<{
    code: string;
    title: string;
    details: string;
    work: string;
    date: string;
    owner: string;
    status: string;
    amount: string;
  }>>([]);
  const [loadingRows, setLoadingRows] = useState(!demoMode);
  const [refreshKey, setRefreshKey] = useState(0);
  const effectiveSearch = localSearch || search;
  const demoRows = useMemo(
    () =>
      [
        { code: `${module.slug.slice(0, 4).toUpperCase()}-0001`, title: module.features[0], details: module.features.slice(1, 4).join(" · "), work: "OB-2026-001", date: "04/09/2026", owner: "Ana Gómez", status: "Activo", amount: "$2,40 M" },
        { code: `${module.slug.slice(0, 4).toUpperCase()}-0002`, title: module.features[1] ?? "Registro", details: module.features.slice(2, 5).join(" · "), work: "OB-2026-005", date: "03/09/2026", owner: "Víctor Encina", status: "Pendiente", amount: "$850.000" },
        { code: `${module.slug.slice(0, 4).toUpperCase()}-0003`, title: module.features[2] ?? "Registro", details: module.features.slice(3, 6).join(" · "), work: "OB-2026-003", date: "02/09/2026", owner: "María López", status: "Aprobado", amount: "$6,12 M" },
        { code: `${module.slug.slice(0, 4).toUpperCase()}-0004`, title: module.features[3] ?? "Registro", details: module.features.slice(0, 3).join(" · "), work: "OB-2026-007", date: "01/09/2026", owner: "Carlos Ruiz", status: "Borrador", amount: "$1,26 M" },
      ].filter((row) =>
        `${row.code} ${row.title} ${row.work} ${row.owner}`
          .toLowerCase()
          .includes(effectiveSearch.toLowerCase()),
      ),
    [effectiveSearch, module],
  );
  const rows = demoMode ? demoRows : apiRows;

  useEffect(() => {
    const refresh = () => setRefreshKey((value) => value + 1);
    window.addEventListener("lnea:records-changed", refresh);
    return () => window.removeEventListener("lnea:records-changed", refresh);
  }, []);

  useEffect(() => {
    if (demoMode || module.slug === "works" || module.slug === "dashboard") return;
    const controller = new AbortController();
    const params = new URLSearchParams();
    if (effectiveSearch.trim()) params.set("search", effectiveSearch.trim().slice(0, 120));
    setLoadingRows(true);
    void apiFetch(`/records/${module.slug}${params.size ? `?${params}` : ""}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("No se pudo cargar el módulo");
        return response.json() as Promise<Array<{
          code: string;
          title: string;
          status: string;
          amount?: string | number | null;
          occurredAt?: string | null;
          updatedAt: string;
          createdById: string;
          data?: Record<string, unknown>;
          work?: { code: string } | null;
        }>>;
      })
      .then((items) => {
        setApiRows(
          items.map((item) => ({
            code: item.code,
            title: item.title,
            details: (recordDefinitions[module.slug]?.fields ?? [])
              .slice(0, 3)
              .map((field) => item.data?.[field.key] == null ? "" : `${field.label}: ${String(item.data[field.key])}`)
              .filter(Boolean)
              .join(" · ") || "Sin datos adicionales",
            work: item.work?.code ?? "General",
            date: new Intl.DateTimeFormat("es-AR").format(
              new Date(item.occurredAt ?? item.updatedAt),
            ),
            owner: `Usuario ${item.createdById.slice(-6)}`,
            status: item.status.charAt(0) + item.status.slice(1).toLowerCase(),
            amount: item.amount == null ? "—" : money(Number(item.amount)),
          })),
        );
      })
      .catch((cause) => {
        if ((cause as { name?: string }).name !== "AbortError") {
          toast.error("No se cargaron los registros", {
            description: cause instanceof Error ? cause.message : "Error de conexión",
          });
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingRows(false);
      });
    return () => controller.abort();
  }, [effectiveSearch, module.slug, refreshKey]);

  return (
    <>
      <PageHeader
        eyebrow={module.group.toUpperCase()}
        title={module.label}
        description={module.summary}
        onCreate={onCreate}
      />
      <section className="role-scope-banner">
        <div>
          <span className="avatar">{user.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}</span>
          <span><small>Perfil activo</small><strong>{user.role}</strong></span>
        </div>
        <p>
          {onCreate
            ? `Puede registrar y modificar movimientos de ${module.label}.`
            : `Acceso de consulta a ${module.label}; la registración corresponde a otro rol.`}
        </p>
        <span className={onCreate ? "scope-status enabled" : "scope-status"}>
          {onCreate ? "Registración habilitada" : "Sólo consulta"}
        </span>
      </section>
      <SectorDashboardPanel module={module} />
      {module.slug === "technical-workspace" && <TechnicalWorkspaceLivePanel />}
      {module.slug === "notifications" && <NotificationCenterLivePanel />}
      <section className="panel module-panel">
        <div className="module-toolbar">
          <div className="inline-search"><Search size={17} /><input value={localSearch} onChange={(event) => setLocalSearch(event.target.value)} placeholder="Buscar registros…" aria-label="Buscar registros" /></div>
          <div>
            <button className="button secondary"><Filter size={17} /> Filtros</button>
            <button className="button secondary"><SlidersHorizontal size={17} /> Columnas</button>
          </div>
        </div>
        <Table className="erp-table module-table">
          <TableHeader><TableRow><TableHead>Código</TableHead><TableHead>Descripción</TableHead><TableHead>Datos característicos</TableHead><TableHead>Obra</TableHead><TableHead>Fecha</TableHead><TableHead>Responsable</TableHead><TableHead>Importe</TableHead><TableHead>Estado</TableHead><TableHead /></TableRow></TableHeader>
          <TableBody>
            {loadingRows && (
              <TableRow><TableCell colSpan={9}><span className="table-loading">Consultando registros…</span></TableCell></TableRow>
            )}
            {!loadingRows && rows.length === 0 && (
              <TableRow><TableCell colSpan={9}><span className="table-loading">No se encontraron registros.</span></TableCell></TableRow>
            )}
            {rows.map((row) => (
              <TableRow key={row.code}>
                <TableCell><span className="code-cell">{row.code}</span></TableCell>
                <TableCell><span className="table-primary">{row.title}</span></TableCell>
                <TableCell><span className="table-details">{row.details}</span></TableCell>
                <TableCell>{row.work}</TableCell>
                <TableCell>{row.date}</TableCell>
                <TableCell>{row.owner}</TableCell>
                <TableCell>{row.amount}</TableCell>
                <TableCell><StatusBadge status={row.status} /></TableCell>
                <TableCell><button className="icon-button" onClick={() => toast.info(`Abriendo ${row.code}`)}><MoreHorizontal size={17} /></button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="table-footer"><span>Mostrando {rows.length}{demoMode ? " de 24" : ""} registros</span><div><button disabled><ArrowLeft size={16} /></button><button className="active">1</button>{demoMode && <><button>2</button><button>3</button><button><ArrowRight size={16} /></button></>}</div></div>
      </section>
      <section className="feature-grid">
        {module.features.map((feature, index) => (
          <div className="feature-card" key={feature}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <strong>{feature}</strong>
            <ArrowUpRight size={17} />
          </div>
        ))}
      </section>
      {module.slug === "system" && (
        <>
          <ModuleConfiguratorPanel />
          <WorkflowConfiguratorPanel />
          <ManualUserAdminPanel />
          <UserRolesPanel />
          <RegistrationRequestsPanel />
          <section className="security-note">
            <ShieldCheck size={24} />
            <div><strong>Control de acceso granular</strong><p>Permisos separados para ver, crear, modificar, aprobar, anular, descargar, exportar y administrar; alcance global o por obra.</p></div>
            <button className="button secondary" onClick={() => onNavigate("approvals")}>Ver aprobaciones</button>
          </section>
        </>
      )}
    </>
  );
}

type ConfiguratorField = {
  id?: string;
  fieldKey: string;
  label: string;
  fieldType: string;
  required: boolean;
  active: boolean;
  options?: string[];
};

type ConfiguratorModule = {
  id?: string;
  slug: string;
  label: string;
  groupName: string;
  summary: string;
  active: boolean;
  requiresWork: boolean;
  fields: ConfiguratorField[];
};

const initialConfiguratorModules: ConfiguratorModule[] = modules.map((module) => ({
  slug: module.slug,
  label: module.label,
  groupName: module.group,
  summary: module.summary,
  active: true,
  requiresWork: recordDefinitions[module.slug]?.requiresWork ?? false,
  fields: (recordDefinitions[module.slug]?.fields ?? []).map((field) => ({
    fieldKey: field.key,
    label: field.label,
    fieldType: field.type === "datetime-local" ? "datetime" : field.type,
    required: field.required ?? false,
    active: true,
  })),
}));

function ModuleConfiguratorPanel() {
  const [items, setItems] = useState<ConfiguratorModule[]>(initialConfiguratorModules);
  const [selectedSlug, setSelectedSlug] = useState("works");
  const [fieldLabel, setFieldLabel] = useState("");
  const [fieldType, setFieldType] = useState("text");
  const [newModule, setNewModule] = useState({ slug: "", label: "", groupName: "Operaciones", summary: "" });
  const [busy, setBusy] = useState(false);
  const [permissionState, setPermissionState] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (demoMode) return;
    void apiFetch("/system/modules")
      .then(async (response) => {
        if (!response.ok) throw new Error("No se pudo cargar la configuración");
        return response.json() as Promise<ConfiguratorModule[]>;
      })
      .then(setItems)
      .catch((cause) => toast.error("Configurador no disponible", {
        description: cause instanceof Error ? cause.message : "Error de conexión",
      }));
  }, []);

  const selected = items.find((item) => item.slug === selectedSlug) ?? items[0];

  const updateModule = async (changes: Partial<ConfiguratorModule>) => {
    if (!selected) return;
    setItems((current) => current.map((item) => item.slug === selected.slug ? { ...item, ...changes } : item));
    if (!demoMode && selected.id) {
      const response = await apiFetch(`/system/modules/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(changes),
      });
      if (!response.ok) throw new Error("No se pudo actualizar el módulo");
    }
    window.dispatchEvent(new Event("lnea:module-config-changed"));
  };

  const addField = async () => {
    if (!selected || !fieldLabel.trim()) return;
    const fieldKey = fieldLabel
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^A-Za-z0-9]+(.)/g, (_match, character: string) => character.toUpperCase())
      .replace(/^[A-Z]/, (character) => character.toLowerCase());
    if (!/^[a-z][A-Za-z0-9]{1,48}$/.test(fieldKey)) {
      toast.error("El nombre del campo no genera un código válido");
      return;
    }
    setBusy(true);
    try {
      let created: ConfiguratorField = { fieldKey, label: fieldLabel.trim(), fieldType, required: false, active: true };
      if (!demoMode && selected.id) {
        const response = await apiFetch(`/system/modules/${selected.id}/fields`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...created, sortOrder: selected.fields.length }),
        });
        if (!response.ok) throw new Error("La API rechazó el nuevo campo");
        created = await response.json() as ConfiguratorField;
      }
      setItems((current) => current.map((item) => item.slug === selected.slug ? { ...item, fields: [...item.fields, created] } : item));
      setFieldLabel("");
      window.dispatchEvent(new Event("lnea:module-config-changed"));
      toast.success("Campo agregado", { description: `${selected.label} · ${created.label}` });
    } catch (cause) {
      toast.error("No se agregó el campo", { description: cause instanceof Error ? cause.message : "Error" });
    } finally {
      setBusy(false);
    }
  };

  const updateField = async (field: ConfiguratorField, changes: Partial<ConfiguratorField>) => {
    if (!selected) return;
    setItems((current) => current.map((item) => item.slug === selected.slug
      ? { ...item, fields: item.fields.map((candidate) => candidate.fieldKey === field.fieldKey ? { ...candidate, ...changes } : candidate) }
      : item));
    try {
      if (!demoMode && field.id) {
        const response = await apiFetch(`/system/module-fields/${field.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(changes),
        });
        if (!response.ok) throw new Error("La API rechazó el cambio");
      }
      window.dispatchEvent(new Event("lnea:module-config-changed"));
    } catch (cause) {
      toast.error("No se actualizó el campo", { description: cause instanceof Error ? cause.message : "Error" });
    }
  };

  const createModule = async () => {
    if (!/^[a-z][a-z0-9-]{1,48}$/.test(newModule.slug) || !newModule.label.trim() || !newModule.summary.trim()) {
      toast.error("Completá código, nombre y descripción del módulo");
      return;
    }
    setBusy(true);
    try {
      let created: ConfiguratorModule = { ...newModule, active: true, requiresWork: false, fields: [] };
      if (!demoMode) {
        const response = await apiFetch("/system/modules", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...newModule, icon: "FileText", sortOrder: items.length }),
        });
        if (!response.ok) throw new Error("La API rechazó el módulo");
        created = { ...(await response.json() as ConfiguratorModule), fields: [] };
      }
      setItems((current) => [...current, created]);
      setSelectedSlug(created.slug);
      setNewModule({ slug: "", label: "", groupName: "Operaciones", summary: "" });
      window.dispatchEvent(new Event("lnea:module-config-changed"));
      toast.success("Módulo creado", { description: "Definí ahora sus campos y permisos." });
    } catch (cause) {
      toast.error("No se creó el módulo", { description: cause instanceof Error ? cause.message : "Error" });
    } finally {
      setBusy(false);
    }
  };

  const permissionKey = (role: string, action: string) => `${role}:${selected?.slug}:${action}`;
  const hasBasePermission = (account: DemoUser, action: string) => {
    if (account.allowedModules.includes("*")) return true;
    if (action === "view") return account.allowedModules.includes(selected?.slug ?? "");
    if (["create", "modify"].includes(action)) return account.allowedCreateModules.includes(selected?.slug ?? "");
    return account.allowedActions.includes(action) && account.allowedModules.includes(selected?.slug ?? "");
  };
  const changePermission = async (account: DemoUser, action: string, allowed: boolean) => {
    const key = permissionKey(account.roleCode, action);
    setPermissionState((current) => ({ ...current, [key]: allowed }));
    if (!demoMode && selected) {
      const response = await apiFetch("/system/role-permissions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roleCode: account.roleCode, module: selected.slug, action, allowed }),
      });
      if (!response.ok) toast.error("No se actualizó el permiso");
    }
  };

  return (
    <section className="panel module-configurator">
      <div className="panel-heading"><div><span className="panel-kicker">CONFIGURACIÓN ADMINISTRATIVA</span><h2>Módulos, campos y permisos</h2></div><span className="registration-count">{items.length} módulos</span></div>
      <div className="configurator-layout">
        <aside>
          <label className="form-field"><span>Módulo</span><select value={selected?.slug ?? ""} onChange={(event) => setSelectedSlug(event.target.value)}>{items.map((item) => <option value={item.slug} key={item.slug}>{item.label}</option>)}</select></label>
          {selected && <div className="module-switches"><label><input type="checkbox" checked={selected.active} onChange={(event) => void updateModule({ active: event.target.checked })} /> Módulo activo</label><label><input type="checkbox" checked={selected.requiresWork} onChange={(event) => void updateModule({ requiresWork: event.target.checked })} /> Obra obligatoria</label></div>}
          <div className="new-module-box"><strong>Nuevo módulo</strong><input placeholder="Código: calidad" value={newModule.slug} onChange={(event) => setNewModule({ ...newModule, slug: event.target.value.toLowerCase() })} /><input placeholder="Nombre" value={newModule.label} onChange={(event) => setNewModule({ ...newModule, label: event.target.value })} /><select value={newModule.groupName} onChange={(event) => setNewModule({ ...newModule, groupName: event.target.value })}>{groups.map((group) => <option key={group}>{group}</option>)}</select><textarea rows={2} placeholder="Objetivo del módulo" value={newModule.summary} onChange={(event) => setNewModule({ ...newModule, summary: event.target.value })} /><button className="button primary" disabled={busy} onClick={() => void createModule()}><Plus size={16} /> Crear módulo</button></div>
        </aside>
        <div className="configurator-main">
          <div className="configured-fields"><div className="configurator-subheading"><strong>Campos de registración · {selected?.label}</strong><small>{selected?.fields.length ?? 0} campos característicos</small></div><div className="field-chip-grid">{selected?.fields.map((field) => <span key={field.fieldKey}><strong>{field.label}</strong><small>{field.fieldType}</small><label><input type="checkbox" checked={field.required} onChange={(event) => void updateField(field, { required: event.target.checked })} /> Obligatorio</label><label><input type="checkbox" checked={field.active} onChange={(event) => void updateField(field, { active: event.target.checked })} /> Activo</label></span>)}</div><div className="add-field-row"><input value={fieldLabel} onChange={(event) => setFieldLabel(event.target.value)} placeholder="Nombre del nuevo campo" /><select value={fieldType} onChange={(event) => setFieldType(event.target.value)}>{["text", "textarea", "number", "currency", "date", "datetime", "select", "boolean", "email", "tax-id", "file"].map((type) => <option key={type}>{type}</option>)}</select><button className="button secondary" disabled={busy || !fieldLabel.trim()} onClick={() => void addField()}><Plus size={16} /> Agregar</button></div></div>
          <div className="permission-matrix"><div className="configurator-subheading"><strong>Permisos por rol</strong><small>Los cambios se auditan en el servidor</small></div><div className="permission-table"><div className="permission-row header"><strong>Rol</strong>{["view", "create", "modify", "approve", "void", "export"].map((action) => <span key={action}>{action}</span>)}</div>{demoAccounts.map((account) => <div className="permission-row" key={account.roleCode}><strong>{account.role}</strong>{["view", "create", "modify", "approve", "void", "export"].map((action) => {const key = permissionKey(account.roleCode, action); const checked = permissionState[key] ?? hasBasePermission(account, action); return <label key={action}><input type="checkbox" checked={checked} onChange={(event) => void changePermission(account, action, event.target.checked)} /><span className="sr-only">{action}</span></label>;})}</div>)}</div></div>
        </div>
      </div>
    </section>
  );
}

type ConfiguratorWorkflow = {
  id?: string;
  code: string;
  module: string;
  name: string;
  minAmount?: number | string | null;
  maxAmount?: number | string | null;
  active: boolean;
  version: number;
  steps: Array<{ role: string; label: string }>;
};

const initialWorkflows: ConfiguratorWorkflow[] = [
  ["WF-COMPRAS-01", "purchases", "Aprobación de compras"],
  ["WF-PAGOS-01", "payments", "Aprobación de pagos"],
  ["WF-VIATICOS-01", "per-diems", "Aprobación de viáticos"],
  ["WF-PRESUP-01", "budgets", "Aprobación de presupuestos"],
  ["WF-CERT-01", "certificates", "Aprobación de certificados"],
  ["WF-DOC-01", "documents", "Aprobación documental"],
  ["WF-HHEE-01", "payroll", "Aprobación de horas extra"],
  ["WF-OT-01", "maintenance", "Aprobación de órdenes de trabajo"],
].map(([code, module, name]) => ({
  code,
  module,
  name,
  active: true,
  version: 1,
  steps: [
    { role: "ADMIN_OBRAS", label: "Control administrativo" },
    { role: "ADMIN_GENERAL", label: "Aprobación final" },
  ],
}));

function WorkflowConfiguratorPanel() {
  const [items, setItems] = useState<ConfiguratorWorkflow[]>(initialWorkflows);
  const [selectedCode, setSelectedCode] = useState(initialWorkflows[0].code);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (demoMode) return;
    void apiFetch("/system/workflows")
      .then(async (response) => {
        if (!response.ok) throw new Error("No se pudieron cargar los flujos");
        return response.json() as Promise<ConfiguratorWorkflow[]>;
      })
      .then((workflows) => {
        setItems(workflows);
        if (workflows[0]) setSelectedCode(workflows[0].code);
      })
      .catch((cause) => toast.error("Flujos no disponibles", {
        description: cause instanceof Error ? cause.message : "Error de conexión",
      }));
  }, []);

  const selected = items.find((item) => item.code === selectedCode) ?? items[0];
  const change = (changes: Partial<ConfiguratorWorkflow>) => {
    if (!selected) return;
    setItems((current) => current.map((item) => item.code === selected.code ? { ...item, ...changes } : item));
  };
  const changeStep = (index: number, role: string) => {
    if (!selected) return;
    const account = demoAccounts.find((candidate) => candidate.roleCode === role);
    change({ steps: selected.steps.map((step, position) => position === index ? { role, label: account?.role ?? role } : step) });
  };
  const save = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      if (!demoMode && selected.id) {
        const response = await apiFetch(`/system/workflows/${selected.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            active: selected.active,
            minAmount: selected.minAmount === "" || selected.minAmount == null ? undefined : Number(selected.minAmount),
            maxAmount: selected.maxAmount === "" || selected.maxAmount == null ? undefined : Number(selected.maxAmount),
            steps: selected.steps,
          }),
        });
        if (!response.ok) throw new Error("La API rechazó la configuración");
      } else {
        await new Promise((resolve) => window.setTimeout(resolve, 220));
      }
      toast.success("Flujo guardado", { description: `${selected.name} · versión ${selected.version}` });
    } catch (cause) {
      toast.error("No se guardó el flujo", { description: cause instanceof Error ? cause.message : "Error" });
    } finally {
      setSaving(false);
    }
  };

  if (!selected) return null;
  return (
    <section className="panel workflow-configurator">
      <div className="panel-heading"><div><span className="panel-kicker">MOTOR DE APROBACIONES</span><h2>Flujos por operación y monto</h2></div><span className="registration-count">{items.length} flujos</span></div>
      <div className="workflow-grid">
        <label className="form-field"><span>Proceso</span><select value={selected.code} onChange={(event) => setSelectedCode(event.target.value)}>{items.map((item) => <option value={item.code} key={item.code}>{item.name}</option>)}</select></label>
        <label className="form-field"><span>Monto mínimo</span><input type="number" min="0" value={selected.minAmount ?? ""} onChange={(event) => change({ minAmount: event.target.value })} /></label>
        <label className="form-field"><span>Monto máximo</span><input type="number" min="0" value={selected.maxAmount ?? ""} onChange={(event) => change({ maxAmount: event.target.value })} /></label>
        <label className="workflow-active"><input type="checkbox" checked={selected.active} onChange={(event) => change({ active: event.target.checked })} /> Flujo activo</label>
      </div>
      <div className="workflow-steps">
        {selected.steps.map((step, index) => <label key={`${selected.code}-${index}`}><span>{index + 1}</span><small>Paso {index + 1}</small><select value={step.role} onChange={(event) => changeStep(index, event.target.value)}>{demoAccounts.map((account) => <option value={account.roleCode} key={account.roleCode}>{account.role}</option>)}</select></label>)}
        <button className="button secondary" type="button" onClick={() => change({ steps: [...selected.steps, { role: "ADMIN_GENERAL", label: "Aprobación final" }] })}><Plus size={16} /> Agregar paso</button>
      </div>
      <div className="workflow-footer"><small>{selected.module} · {selected.code} · todas las modificaciones quedan auditadas</small><button className="button primary" disabled={saving} type="button" onClick={() => void save()}><Check size={16} /> {saving ? "Guardando…" : "Guardar flujo"}</button></div>
    </section>
  );
}

type AdminRoleOption = {
  code: string;
  name: string;
};

function ManualUserAdminPanel() {
  const [roles, setRoles] = useState<AdminRoleOption[]>([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    username: "",
    roleCode: "TEC_JEFE_OBRA",
    password: "",
    status: "ACTIVE",
  });

  useEffect(() => {
    if (demoMode) {
      setRoles(demoAccounts.map((account) => ({ code: account.roleCode, name: account.role })));
      return;
    }
    void apiFetch("/system/roles")
      .then(async (response) => {
        if (!response.ok) throw new Error("No se pudieron cargar los roles");
        const payload = (await response.json()) as Array<{ code: string; name: string }>;
        setRoles(payload.map(({ code, name }) => ({ code, name })));
        if (payload[0]) {
          setForm((current) =>
            payload.some((role) => role.code === current.roleCode)
              ? current
              : { ...current, roleCode: payload[0].code },
          );
        }
      })
      .catch((cause) =>
        toast.error("No se cargaron los roles", {
          description: cause instanceof Error ? cause.message : "Error de conexión",
        }),
      );
  }, []);

  const update = (key: keyof typeof form, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));

  const createUser = async () => {
    if (!form.firstName.trim() || !form.lastName.trim() || !form.email.trim() || !form.password) {
      toast.error("Completá nombre, apellido, correo y contraseña inicial.");
      return;
    }
    if (form.password.length < 10) {
      toast.error("La contraseña inicial debe tener al menos 10 caracteres.");
      return;
    }
    setSaving(true);
    try {
      if (demoMode) {
        await new Promise((resolve) => window.setTimeout(resolve, 250));
      } else {
        const response = await apiFetch("/system/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            firstName: form.firstName.trim(),
            lastName: form.lastName.trim(),
            email: form.email.trim().toLowerCase(),
            username: form.username.trim() || undefined,
            roleCode: form.roleCode,
            password: form.password,
            status: form.status,
          }),
        });
        if (!response.ok) {
          const problem = (await response.json().catch(() => null)) as { message?: string | string[] } | null;
          const message = Array.isArray(problem?.message)
            ? problem?.message.join(". ")
            : problem?.message;
          throw new Error(message ?? "La API rechazó el alta.");
        }
      }
      toast.success("Usuario creado", {
        description: `${form.firstName.trim()} ${form.lastName.trim()} quedó registrado y auditado.`,
      });
      setForm({
        firstName: "",
        lastName: "",
        email: "",
        username: "",
        roleCode: roles[0]?.code ?? "TEC_JEFE_OBRA",
        password: "",
        status: "ACTIVE",
      });
      window.dispatchEvent(new Event("lnea:users-changed"));
    } catch (cause) {
      toast.error("No se pudo crear el usuario", {
        description: cause instanceof Error ? cause.message : "Error no identificado",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="panel registration-panel">
      <div className="panel-heading">
        <div>
          <span className="panel-kicker">Administración de acceso</span>
          <h2>Alta manual de usuarios</h2>
        </div>
        <span className="registration-count">Administrador</span>
      </div>
      <div className="dialog-form">
        <div className="two-fields">
          <label className="form-field">
            <span>Nombre *</span>
            <input value={form.firstName} onChange={(event) => update("firstName", event.target.value)} />
          </label>
          <label className="form-field">
            <span>Apellido *</span>
            <input value={form.lastName} onChange={(event) => update("lastName", event.target.value)} />
          </label>
        </div>
        <div className="two-fields">
          <label className="form-field">
            <span>Correo *</span>
            <input type="email" value={form.email} onChange={(event) => update("email", event.target.value)} placeholder="usuario@litoralnea.com" />
          </label>
          <label className="form-field">
            <span>Usuario</span>
            <input value={form.username} onChange={(event) => update("username", event.target.value)} placeholder="Se genera desde el correo si se deja vacío" />
          </label>
        </div>
        <div className="two-fields">
          <label className="form-field">
            <span>Rol *</span>
            <select value={form.roleCode} onChange={(event) => update("roleCode", event.target.value)}>
              {roles.map((role) => <option key={role.code} value={role.code}>{role.name}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>Estado inicial</span>
            <select value={form.status} onChange={(event) => update("status", event.target.value)}>
              <option value="ACTIVE">Activo</option>
              <option value="DISABLED">Deshabilitado</option>
            </select>
          </label>
        </div>
        <label className="form-field">
          <span>Contraseña inicial *</span>
          <input type="password" autoComplete="new-password" value={form.password} onChange={(event) => update("password", event.target.value)} placeholder="Mínimo 10 caracteres" />
        </label>
        <div className="workflow-footer">
          <small>El alta registra usuario creador, fecha y rol en auditoría. La contraseña nunca se guarda en el log.</small>
          <button className="button primary" type="button" disabled={saving || roles.length === 0} onClick={() => void createUser()}>
            <Plus size={16} /> {saving ? "Creando…" : "Crear usuario"}
          </button>
        </div>
      </div>
    </section>
  );
}

function UserRolesPanel() {
  return (
    <section className="panel user-roles-panel">
      <div className="panel-heading">
        <div><span className="panel-kicker">RBAC operativo</span><h2>Usuarios, roles y registraciones</h2></div>
        <span className="registration-count">7 usuarios activos</span>
      </div>
      <div className="role-user-grid">
        {demoAccounts.map((account) => (
          <article key={account.username}>
            <div className="role-user-heading">
              <span className="avatar">{account.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}</span>
              <span><strong>{account.name}</strong><small>{account.role}</small></span>
              <em>Activo</em>
            </div>
            <dl>
              <div><dt>Usuario</dt><dd>{account.username}</dd></div>
              <div><dt>Obras</dt><dd>{account.assignedWorks.length ? account.assignedWorks.join(" · ") : "Todas"}</dd></div>
            </dl>
            <ul>
              {account.responsibilities.map((item) => <li key={item}><Check size={14} /> {item}</li>)}
            </ul>
          </article>
        ))}
      </div>
    </section>
  );
}

type RegistrationRequestItem = {
  id: string;
  provider: "GOOGLE" | "MICROSOFT";
  email: string;
  firstName: string;
  lastName: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  requestedAt: string;
};

const demoRegistrationRequests: RegistrationRequestItem[] = [
  {
    id: "demo-google-subject-pending",
    provider: "GOOGLE",
    email: "postulante.demo@litoralnea.example",
    firstName: "Usuario",
    lastName: "Pendiente",
    status: "PENDING",
    requestedAt: "2026-09-04T11:20:00.000Z",
  },
];

function RegistrationRequestsPanel() {
  const [requests, setRequests] = useState<RegistrationRequestItem[]>(
    demoMode ? demoRegistrationRequests : [],
  );
  const [loading, setLoading] = useState(!demoMode);
  const [workingId, setWorkingId] = useState("");
  const [roleByRequest, setRoleByRequest] = useState<Record<string, string>>({});

  useEffect(() => {
    if (demoMode) return;
    void apiFetch("/system/registration-requests?status=PENDING")
      .then(async (response) => {
        if (!response.ok) throw new Error("No se pudo consultar la bandeja");
        setRequests((await response.json()) as RegistrationRequestItem[]);
      })
      .catch((cause) =>
        toast.error("No se cargaron las solicitudes", {
          description: cause instanceof Error ? cause.message : "Error de conexión",
        }),
      )
      .finally(() => setLoading(false));
  }, []);

  const review = async (request: RegistrationRequestItem, approve: boolean) => {
    setWorkingId(request.id);
    const roleCode = roleByRequest[request.id] ?? "TEC_JEFE_OBRA";
    try {
      if (!demoMode) {
        const response = await apiFetch(
          `/system/registration-requests/${request.id}/${approve ? "approve" : "reject"}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(
              approve
                ? { roleCode }
                : { reason: "Solicitud rechazada por revisión administrativa" },
            ),
          },
        );
        if (!response.ok) throw new Error("La API rechazó la decisión");
      } else {
        await new Promise((resolve) => window.setTimeout(resolve, 320));
      }
      setRequests((current) => current.filter((item) => item.id !== request.id));
      toast.success(approve ? "Registro aprobado" : "Registro rechazado", {
        description: approve
          ? `${request.email} podrá ingresar con su cuenta vinculada y el rol seleccionado.`
          : `${request.email} fue retirado de la bandeja pendiente.`,
      });
    } catch (cause) {
      toast.error("No se pudo registrar la decisión", {
        description: cause instanceof Error ? cause.message : "Error no identificado",
      });
    } finally {
      setWorkingId("");
    }
  };

  return (
    <section className="panel registration-panel">
      <div className="panel-heading">
        <div>
          <span className="panel-kicker">Acceso externo</span>
          <h2>Solicitudes de registración</h2>
        </div>
        <span className="registration-count">{requests.length} pendientes</span>
      </div>
      {loading ? (
        <p className="registration-empty">Consultando solicitudes seguras…</p>
      ) : requests.length === 0 ? (
        <p className="registration-empty">No hay solicitudes pendientes de revisión.</p>
      ) : (
        <div className="registration-list">
          {requests.map((request) => (
            <article key={request.id}>
              <span className={`registration-provider ${request.provider.toLowerCase()}`}>
                {request.provider === "GOOGLE" ? "G" : "M"}
              </span>
              <div>
                <strong>{request.firstName} {request.lastName}</strong>
                <span>{request.email}</span>
                <small>
                  {request.provider === "GOOGLE" ? "Cuenta Google" : "Cuenta Microsoft / Hotmail"}
                  {demoMode ? " · solicitud demostrativa" : ""}
                </small>
              </div>
              <div className="registration-actions">
                <select
                  aria-label={`Rol para ${request.email}`}
                  value={roleByRequest[request.id] ?? "TEC_JEFE_OBRA"}
                  onChange={(event) =>
                    setRoleByRequest((current) => ({ ...current, [request.id]: event.target.value }))
                  }
                >
                  {demoAccounts.slice(1).map((account) => (
                    <option value={account.roleCode} key={account.roleCode}>{account.role}</option>
                  ))}
                </select>
                <button
                  className="button secondary danger"
                  type="button"
                  disabled={workingId === request.id}
                  onClick={() => void review(request, false)}
                >
                  <X size={16} /> Rechazar
                </button>
                <button
                  className="button primary"
                  type="button"
                  disabled={workingId === request.id}
                  onClick={() => void review(request, true)}
                >
                  <Check size={16} /> Aprobar usuario
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function QuickCreateDialog({
  open,
  onOpenChange,
  module,
  workItems,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  module: ModuleDefinition;
  workItems: Work[];
}) {
  const definition = module.recordDefinition ?? recordDefinitions[module.slug] ?? fallbackRecordDefinition;
  const [title, setTitle] = useState("");
  const [workId, setWorkId] = useState(workItems[0]?.id ?? "");
  const [occurredAt, setOccurredAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [status, setStatus] = useState("DRAFT");
  const [fieldValues, setFieldValues] = useState<Record<string, string | boolean>>({});
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!workId && workItems[0]) setWorkId(workItems[0].id);
  }, [workId, workItems]);

  useEffect(() => {
    setTitle("");
    setFieldValues({});
    setFile(null);
    setStatus("DRAFT");
  }, [module.slug]);

  const setFieldValue = (key: string, value: string | boolean) =>
    setFieldValues((current) => ({ ...current, [key]: value }));

  const normalizedData = Object.fromEntries(
    definition.fields
      .filter((field) => fieldValues[field.key] !== undefined && fieldValues[field.key] !== "")
      .map((field) => {
        const value = fieldValues[field.key];
        if (["number", "currency"].includes(field.type)) return [field.key, Number(value)];
        return [field.key, value];
      }),
  );

  const save = async () => {
    if (!title.trim()) {
      toast.error(`Completá: ${definition.titleLabel}`);
      return;
    }
    const missing = definition.fields.filter(
      (field) => field.required && (fieldValues[field.key] === undefined || fieldValues[field.key] === ""),
    );
    if (missing.length) {
      toast.error("Faltan datos obligatorios", {
        description: missing.map((field) => field.label).join(" · "),
      });
      return;
    }
    if (definition.requiresWork && !workId) {
      toast.error("Seleccioná la obra / centro de costo");
      return;
    }
    setSaving(true);
    try {
      if (!demoMode && apiUrl) {
        let response: Response;
        if (module.slug === "documents" && file) {
          const form = new FormData();
          form.append("file", file);
          form.append("module", module.slug);
          form.append("title", title.trim());
          if (workId) form.append("workId", workId);
          const documentDescription = [
            normalizedData.documentType,
            normalizedData.revision ? `Revisión ${normalizedData.revision}` : "",
            normalizedData.versionNotes,
          ].filter(Boolean).join(" · ");
          if (documentDescription) form.append("description", documentDescription);
          response = await apiFetch("/documents", {
            method: "POST",
            body: form,
          });
        } else if (module.slug === "works") {
          response = await apiFetch("/works", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              code: `${definition.codePrefix}-${Date.now().toString().slice(-8)}`,
              name: title.trim(),
              status: "PLANNING",
              clientName: normalizedData.client,
              organizationType: ({
                "Ministerio": "MINISTRY",
                "Municipio": "MUNICIPALITY",
                "Organismo público": "PUBLIC_AGENCY",
                "Privado": "PRIVATE",
              } as Record<string, string>)[String(normalizedData.organizationType)] ?? "PRIVATE",
              costCenter: normalizedData.costCenter,
              agency: normalizedData.agency,
              ministry: normalizedData.ministry,
              municipality: normalizedData.municipality,
              contractNumber: normalizedData.contractNumber,
              dossierNumber: normalizedData.dossierNumber,
              address: normalizedData.address,
              city: normalizedData.city,
              latitude: normalizedData.latitude,
              longitude: normalizedData.longitude,
              startDate: normalizedData.startDate,
              contractualEndDate: normalizedData.contractualEndDate,
              contractAmount: normalizedData.contractAmount,
              targetBudget: normalizedData.targetBudget,
              responsibleName: normalizedData.responsibleName,
              notes: normalizedData.notes,
            }),
          });
        } else {
          response = await apiFetch(`/records/${module.slug}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              code: `${definition.codePrefix}-${Date.now()}`,
              title: title.trim(),
              workId: workId || undefined,
              occurredAt,
              status,
              amount: definition.amountField
                ? Number(normalizedData[definition.amountField] ?? 0)
                : undefined,
              data: normalizedData,
            }),
          });
        }
        if (!response.ok) {
          const problem = (await response.json().catch(() => null)) as {
            message?: string | string[];
          } | null;
          throw new Error(
            Array.isArray(problem?.message)
              ? problem.message.join(". ")
              : problem?.message ?? "La API rechazó el registro.",
          );
        }
        const created = await response.json().catch(() => null) as { id?: string } | null;
        if (file && module.slug !== "documents" && created?.id) {
          const attachment = new FormData();
          attachment.append("file", file);
          attachment.append("module", module.slug);
          attachment.append("title", `${module.label} · ${title.trim()}`);
          attachment.append("entityType", module.slug === "works" ? "work" : "generic-record");
          attachment.append("entityId", created.id);
          if (module.slug === "works") attachment.append("workId", created.id);
          else if (workId) attachment.append("workId", workId);
          const attachmentResponse = await apiFetch("/documents", { method: "POST", body: attachment });
          if (!attachmentResponse.ok) {
            toast.warning("Registro guardado sin adjunto", {
              description: "El archivo fue rechazado; puede adjuntarse nuevamente desde Documentación.",
            });
          }
        }
        toast.success("Registro guardado", {
          description: `${module.label} · auditoría generada`,
        });
        window.dispatchEvent(new Event("lnea:records-changed"));
      } else {
        await new Promise((resolve) => window.setTimeout(resolve, 280));
        toast.success("Registro demo creado", {
          description: `${module.label} · modo demostración`,
        });
      }
      setTitle("");
      setFieldValues({});
      setFile(null);
      onOpenChange(false);
    } catch (cause) {
      toast.error("No se pudo guardar", {
        description:
          cause instanceof Error ? cause.message : "Error no identificado",
      });
    } finally {
      setSaving(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="erp-dialog">
        <DialogHeader>
          <DialogTitle>Nuevo registro · {module.label}</DialogTitle>
          <DialogDescription>
            La operación quedará asociada al usuario, la fecha y la obra seleccionada.
          </DialogDescription>
        </DialogHeader>
        <div className="dialog-form">
          <label className="form-field"><span>{definition.titleLabel} *</span><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder={definition.titleLabel} /></label>
          {module.slug !== "works" && (
            <label className="form-field"><span>Obra / centro de costo{definition.requiresWork ? " *" : ""}</span><select value={workId} onChange={(event) => setWorkId(event.target.value)}>{!definition.requiresWork && <option value="">General / sin obra</option>}{workItems.map((work) => <option value={work.id} key={work.id}>{work.code} · {work.name}</option>)}</select></label>
          )}
          <div className="two-fields">
            <label className="form-field"><span>Fecha</span><input type="date" value={occurredAt} onChange={(event) => setOccurredAt(event.target.value)} /></label>
            <label className="form-field"><span>Estado</span><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="DRAFT">Borrador</option><option value="PENDING">Pendiente</option><option value="ACTIVE">Activo</option></select></label>
          </div>
          <div className="characteristic-fields">
            {definition.fields.map((field) => (
              <CharacteristicField
                key={field.key}
                field={field}
                value={fieldValues[field.key] ?? (field.type === "boolean" ? false : "")}
                onChange={(value) => setFieldValue(field.key, value)}
              />
            ))}
          </div>
          <label className="upload-zone"><Upload size={22} /><span><strong>{file ? file.name : "Adjuntar documentación"}</strong><small>PDF, XLSX, DOCX, DWG, DXF, JPG, PNG o ZIP</small></span><input type="file" onChange={(event) => setFile(event.target.files?.[0] ?? null)} /></label>
        </div>
        <DialogFooter>
          <button className="button secondary" onClick={() => onOpenChange(false)}>Cancelar</button>
          <button className="button primary" onClick={save} disabled={saving}><Check size={17} /> {saving ? "Guardando…" : "Guardar registro"}</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CharacteristicField({
  field,
  value,
  onChange,
}: {
  field: RecordFieldDefinition;
  value: string | boolean;
  onChange: (value: string | boolean) => void;
}) {
  if (field.type === "boolean") {
    return (
      <label className="form-field boolean-field">
        <input type="checkbox" checked={Boolean(value)} onChange={(event) => onChange(event.target.checked)} />
        <span>{field.label}{field.required ? " *" : ""}</span>
      </label>
    );
  }
  if (field.type === "textarea") {
    return (
      <label className="form-field field-wide"><span>{field.label}{field.required ? " *" : ""}</span><textarea rows={3} value={String(value)} onChange={(event) => onChange(event.target.value)} placeholder={field.placeholder} /></label>
    );
  }
  if (field.type === "select") {
    return (
      <label className="form-field"><span>{field.label}{field.required ? " *" : ""}</span><select value={String(value)} onChange={(event) => onChange(event.target.value)}><option value="">Seleccionar…</option>{field.options?.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
    );
  }
  const inputType = field.type === "currency" || field.type === "number"
    ? "number"
    : field.type === "tax-id"
      ? "text"
      : field.type;
  return (
    <label className="form-field"><span>{field.label}{field.required ? " *" : ""}</span><input type={inputType} step={field.type === "currency" ? "0.01" : field.type === "number" ? "any" : undefined} value={String(value)} onChange={(event) => onChange(event.target.value)} placeholder={field.placeholder} /></label>
  );
}

function StatusBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  const tone =
    normalized.includes("atención") || normalized.includes("pendiente")
      ? "warning"
      : normalized.includes("borrador")
        ? "neutral"
        : "success";
  return <span className={`status-badge ${tone}`}><i />{status}</span>;
}
