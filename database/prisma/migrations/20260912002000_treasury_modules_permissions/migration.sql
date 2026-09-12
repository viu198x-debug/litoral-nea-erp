INSERT INTO "ModuleConfiguration" ("id", "slug", "label", "groupName", "icon", "summary", "active", "requiresWork", "isSystem", "sortOrder", "createdAt", "updatedAt")
VALUES
  ('mod_treasury', 'treasury', 'Tesorería', 'Finanzas', 'WalletCards', 'Control integral de disponibilidades, ingresos, egresos, transferencias, conciliaciones y proyección financiera.', true, false, true, 1, NOW(), NOW()),
  ('mod_treasury_accounts', 'treasury-accounts', 'Cuentas y billeteras', 'Finanzas', 'Landmark', 'Maestro de cuentas bancarias, billeteras virtuales, CBU/CVU, alias, monedas y saldos.', true, false, true, 2, NOW(), NOW())
ON CONFLICT ("slug") DO UPDATE SET
  "label" = EXCLUDED."label",
  "groupName" = EXCLUDED."groupName",
  "icon" = EXCLUDED."icon",
  "summary" = EXCLUDED."summary",
  "active" = true,
  "updatedAt" = NOW();

INSERT INTO "Permission" ("id", "module", "action", "description")
SELECT 'perm_treasury_' || a.action, 'treasury', a.action, 'Tesorería'
FROM (VALUES ('view'), ('download'), ('export'), ('admin')) AS a(action)
ON CONFLICT ("module", "action") DO NOTHING;

INSERT INTO "Permission" ("id", "module", "action", "description")
SELECT 'perm_treasury_accounts_' || a.action, 'treasury-accounts', a.action, 'Tesorería'
FROM (VALUES ('view'), ('create'), ('modify'), ('approve'), ('void'), ('download'), ('export'), ('admin')) AS a(action)
ON CONFLICT ("module", "action") DO NOTHING;

INSERT INTO "RolePermission" ("roleId", "permissionId", "allowed")
SELECT r."id", p."id", true
FROM "Role" r
JOIN "Permission" p ON p."module" IN ('treasury', 'treasury-accounts')
WHERE r."code" IN ('ADMIN_GENERAL', 'GERENTE_EMPRESA', 'ADM_COMPRAS_TESORERIA')
ON CONFLICT ("roleId", "permissionId") DO UPDATE SET "allowed" = true;

INSERT INTO "ModuleFieldConfiguration" ("id", "moduleId", "fieldKey", "label", "fieldType", "required", "options", "settings", "sortOrder", "active", "createdAt", "updatedAt")
VALUES
 ('fld_tacc_type','mod_treasury_accounts','accountType','Tipo','select',true,'["Cuenta bancaria","Billetera virtual"]','{}',1,true,NOW(),NOW()),
 ('fld_tacc_inst','mod_treasury_accounts','institution','Banco / proveedor','text',true,'[]','{}',2,true,NOW(),NOW()),
 ('fld_tacc_name','mod_treasury_accounts','accountName','Nombre de cuenta','text',true,'[]','{}',3,true,NOW(),NOW()),
 ('fld_tacc_num','mod_treasury_accounts','accountNumber','Número / identificador','text',true,'[]','{}',4,true,NOW(),NOW()),
 ('fld_tacc_cbu','mod_treasury_accounts','cbuOrCvu','CBU / CVU','text',false,'[]','{}',5,true,NOW(),NOW()),
 ('fld_tacc_alias','mod_treasury_accounts','alias','Alias','text',false,'[]','{}',6,true,NOW(),NOW()),
 ('fld_tacc_currency','mod_treasury_accounts','currency','Moneda','select',true,'["ARS","USD"]','{}',7,true,NOW(),NOW()),
 ('fld_tacc_open','mod_treasury_accounts','openingBalance','Saldo inicial','currency',false,'[]','{}',8,true,NOW(),NOW())
ON CONFLICT ("moduleId", "fieldKey") DO UPDATE SET
 "label"=EXCLUDED."label", "fieldType"=EXCLUDED."fieldType", "required"=EXCLUDED."required", "options"=EXCLUDED."options", "sortOrder"=EXCLUDED."sortOrder", "active"=true, "updatedAt"=NOW();
