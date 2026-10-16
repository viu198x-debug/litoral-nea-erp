import { specializedModuleDefinitions, type SpecializedModuleSlug } from "@frontend/lib/module-field-catalog";

export function SpecializedFieldOverview({ slug }: { slug: SpecializedModuleSlug }) {
  const definition = specializedModuleDefinitions[slug];
  return (
    <section className="panel module-panel">
      <div className="panel-heading">
        <div><span className="panel-kicker">Definición funcional</span><h2>Campos y orígenes de datos</h2></div>
      </div>
      <p>{definition.description}</p>
      <p><strong>Servicios específicos:</strong> {definition.endpoints.join(" · ")}</p>
      <div className="feature-grid">
        {definition.fields.map((field) => (
          <div className="feature-card" key={field.key}>
            <small>{field.section}</small>
            <strong>{field.label}</strong>
            <small>{field.required ? "Obligatorio en la operación" : field.type}</small>
          </div>
        ))}
      </div>
    </section>
  );
}
