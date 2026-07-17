#!/usr/bin/env python3
"""Third-party OSCAL ingestion proof (ADR-0031).

The OSCAL component-definition runward emits is validated in CI against the NIST 1.1.2 JSON
schema (test/oscal-schema.js) and pinned byte-for-byte by a golden test. That proves *our*
copy of the schema is satisfied. This closes the harder question a regulated buyer asks:
does the pack load in a real, independent OSCAL tool?

It ingests the pack with IBM compliance-trestle — a compliance toolkit used in FedRAMP/NIST
workflows, whose Pydantic models are generated from the NIST OSCAL metaschemas. If the file
violates the NIST model (a missing required field, a bad enum, a malformed UUID), oscal_read
raises and this script exits non-zero. End-to-end ingestion into a specific GRC *SaaS*
(RegScale/Paramify/Xacta) remains the operator's verification; this proves the artifact is
ingestible by a genuine, third-party OSCAL tool — not only by our own schema check.

Usage: python test/oscal-ingest.py <path-to-oscal-component-definition.json>
"""
import sys
from pathlib import Path
from trestle.oscal.component import ComponentDefinition

path = Path(sys.argv[1])
cd = ComponentDefinition.oscal_read(path)  # raises on any NIST-model violation

version = cd.metadata.oscal_version
assert version == "1.1.2", f"unexpected oscal-version: {version}"
components = cd.components or []
reqs = sum(
    len(ci.implemented_requirements or [])
    for c in components
    for ci in (c.control_implementations or [])
)
assert components, "no components ingested"
assert reqs > 0, "no implemented-requirements ingested"

print(
    f"OK: compliance-trestle ingested {len(components)} component(s), "
    f"{reqs} implemented-requirement(s), OSCAL {version} — "
    f"the pack loads in a real third-party tool."
)
