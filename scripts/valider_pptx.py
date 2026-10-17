"""Valide chaque partie XML d'un .pptx contre les schémas ISO/IEC 29500 (PKG-C : le PPT de validation émis).

Usage : python3 scripts/valider_pptx.py --schemas <dossier des XSD> fichier.pptx [...]

Le dossier des schémas contient `ISO-IEC29500-4_2016/` (pml.xsd, dml-main.xsd, shared-*.xsd) et `ecma/fouth-edition/`
(opc-*.xsd), tels que les distribue l'ECMA (ECMA-376) ; ils ne sont pas versés au dépôt. Exige lxml.
Les présentations, diapositives, dispositions, masques, notes et étiquettes se valident contre pml.xsd, les thèmes contre
dml-main.xsd, les relations, types et propriétés contre leurs schémas OPC ; core.xml n'est pas validé (dcterms).
"""
import argparse
import sys
import zipfile
from pathlib import Path

import lxml.etree as ET


def main() -> int:
    a = argparse.ArgumentParser()
    a.add_argument("--schemas", required=True, type=Path)
    a.add_argument("fichiers", nargs="+", type=Path)
    args = a.parse_args()
    b = args.schemas
    chemins = {
        "pml": b / "ISO-IEC29500-4_2016/pml.xsd", "dml": b / "ISO-IEC29500-4_2016/dml-main.xsd",
        "ct": b / "ecma/fouth-edition/opc-contentTypes.xsd", "rels": b / "ecma/fouth-edition/opc-relationships.xsd",
        "app": b / "ISO-IEC29500-4_2016/shared-documentPropertiesExtended.xsd",
        "custom": b / "ISO-IEC29500-4_2016/shared-documentPropertiesCustom.xsd",
    }
    schemas: dict[str, ET.XMLSchema] = {}

    def cle(n: str):
        if n == "[Content_Types].xml": return "ct"
        if n.endswith(".rels"): return "rels"
        if n.endswith("app.xml"): return "app"
        if n.endswith("custom.xml"): return "custom"
        if "/theme/" in n: return "dml"
        if n.startswith("ppt/") and n.endswith(".xml"): return "pml"
        return None

    vues = erreurs = 0
    for f in args.fichiers:
        z = zipfile.ZipFile(f)
        for n in z.namelist():
            k = cle(n)
            o = z.read(n)
            if not k or not o:
                continue
            if k not in schemas:
                schemas[k] = ET.XMLSchema(ET.parse(str(chemins[k])))
            vues += 1
            if not schemas[k].validate(ET.ElementTree(ET.fromstring(o))):
                erreurs += 1
                for e in list(schemas[k].error_log)[:3]:
                    print(f"{f.name}:{n}: {e.message[:240]}")
    print(f"{vues} parties validées, {erreurs} en erreur")
    return 1 if erreurs else 0


if __name__ == "__main__":
    sys.exit(main())
