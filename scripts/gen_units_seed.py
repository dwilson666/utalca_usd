"""Genera supabase/seed/units.sql desde seed-data/organizational_units.v0.1.json.
Uso:  python scripts/gen_units_seed.py
Parte de la estrategia de mejora continua: el catálogo de unidades es un dato
maestro versionado (v0.1 -> vN); este script lo traduce a SQL idempotente.
"""
import json, pathlib, sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
src = ROOT / "seed-data" / "organizational_units.v0.1.json"
out = ROOT / "supabase" / "seed" / "units.sql"

d = json.loads(src.read_text(encoding="utf-8"))
units = d["units"]


def q(s):
    return "null" if s is None else "'" + str(s).replace("'", "''") + "'"


parts = [
    "-- GENERADO por scripts/gen_units_seed.py desde seed-data/organizational_units.v0.1.json",
    "-- No editar a mano. Idempotente (on conflict do nothing / update por code).",
    "set app.bootstrap = 'on';",
    "",
    "insert into organizational_units "
    "(code,name_official,name_short,acronym,type,campus,is_rat_unit,deferred,needs_review,sort_order,external_ref,notes) values",
]

rows = []
for x in units:
    is_rat = "false" if x["type"] in ("consejo", "rectoria") else "true"
    rows.append(
        "  ({},{},{},{},{},{},{},{},{},{},{},{})".format(
            q(x["code"]), q(x["name"]), q(x.get("short") or x["name"]),
            q(x.get("acronym")), q(x["type"]), q(x.get("campus")),
            is_rat,
            "true" if x.get("deferred") else "false",
            "true" if x.get("needs_review") else "false",
            x.get("sort_order", 0),
            q("RU N°1053-2025"),
            q(x.get("notes")),
        )
    )
parts.append(",\n".join(rows) + "\non conflict (code) do nothing;")
parts.append("")

parts.append("-- parentesco")
for x in units:
    if x["parent_code"]:
        parts.append(
            "update organizational_units c set parent_id = p.id "
            "from organizational_units p where c.code = {} and p.code = {};".format(
                q(x["code"]), q(x["parent_code"])
            )
        )
parts.append("")

parts.append("-- alias de nomenclatura")
for x in units:
    for a in x.get("aliases", []):
        parts.append(
            "insert into organizational_unit_aliases (unit_id,alias,source,is_primary) "
            "select id,{},{},{} from organizational_units where code = {} "
            "on conflict (alias,source) do nothing;".format(
                q(a["alias"]), q(a["source"]),
                "true" if a.get("is_primary") else "false", q(x["code"]),
            )
        )
parts.append("")
parts.append("select app.rebuild_unit_closure();")
parts.append("reset app.bootstrap;")

out.write_text("\n".join(parts) + "\n", encoding="utf-8")
print(f"{len(units)} unidades -> {out.relative_to(ROOT)}")
