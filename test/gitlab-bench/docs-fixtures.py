"""The GitLab bench, layer 1: the fixtures copied from the GitLab API documentation.

Until the CI bench (.github/workflows/gitlab-bench.yml) has recorded a response from a real GitLab CE
instance, the fixtures under test/fixtures/gitlab/ are the response examples of the GitLab API
documentation, copied by this script from the documentation at one pinned commit of
gitlab-org/gitlab, and marked "source": "docs-example". A recorded fixture of the same name replaces
its docs example (docs/gitlab-bench.md). Network: this script reads gitlab.com; the tests never do.

Usage: python3 test/gitlab-bench/docs-fixtures.py test/fixtures/gitlab
"""
import json, re, sys, urllib.request

SHA = "a8d9fc5471e1ed3c1c2d575601b0193d9850ca01"  # gitlab-org/gitlab master, read 2026-10-13
OUT = sys.argv[1]


def doc(fname):
    url = f"https://gitlab.com/gitlab-org/gitlab/-/raw/{SHA}/doc/api/{fname}"
    with urllib.request.urlopen(url, timeout=30) as r:
        return r.read().decode("utf-8")


items = [
  ("notes.md", "### Retrieve a merge request note", "mr-note-get", "GET /projects/:id/merge_requests/:merge_request_iid/notes/:note_id"),
  ("merge_requests.md", "## Retrieve merge request commits", "mr-commits", "GET /projects/:id/merge_requests/:merge_request_iid/commits"),
  ("merge_requests.md", "## Retrieve merge request diff versions", "mr-versions", "GET /projects/:id/merge_requests/:merge_request_iid/versions"),
  ("merge_request_approvals.md", "### Retrieve approval state for a merge request", "mr-approvals", "GET /projects/:id/merge_requests/:merge_request_iid/approvals"),
  ("merge_request_approvals.md", "### Retrieve approval details for a merge request", "mr-approval-state", "GET /projects/:id/merge_requests/:merge_request_iid/approval_state"),
  ("merge_request_approvals.md", "## Approve merge request", "mr-approve", "POST /projects/:id/merge_requests/:merge_request_iid/approve"),
  ("pipelines.md", "## Retrieve a single pipeline", "pipeline-get", "GET /projects/:id/pipelines/:pipeline_id"),
]
for fname, heading, name, endpoint in items:
    lines = doc(fname).split("\n")
    start = lines.index(heading)
    level = len(heading.split(" ")[0])
    end = len(lines)
    for i in range(start + 1, len(lines)):
        m = re.match(r"^(#+) ", lines[i])
        if m and len(m.group(1)) <= level:
            end = i; break
    sec = "\n".join(lines[start:end])
    tier = re.search(r"^- Tier: (.+)$", sec, re.M)
    if not tier:
        tier = re.search(r"^- Tier: (.+)$", "\n".join(lines[:40]), re.M)
    blocks = re.findall(r"```json\n(.*?)\n```", sec, re.S)
    body = json.loads(blocks[0])
    url = re.search(r'--url "https://gitlab\.example\.com(/api/v4/[^"]+)"', sec)
    method = endpoint.split(" ")[0]
    path = url.group(1) if url else "/api/v4" + endpoint.split(" ")[1].replace(":merge_request_iid", "1").replace(":id", "1")
    fx = {
      "fixture": name, "source": "docs-example", "endpoint": endpoint,
      "gitlab": {"edition": "documented", "version": None, "tier": tier.group(1) if tier else None},
      "docs": {"file": f"https://gitlab.com/gitlab-org/gitlab/-/blob/{SHA}/doc/api/{fname}",
               "commit": SHA, "section": heading.lstrip("# ")},
      "recorded_at": "2026-10-13",
      "note": "Copied from the GitLab API documentation example, not recorded from an instance. The documentation does not state the GitLab version or edition of its examples, nor the HTTP status (here the REST default: 200 for a read, 201 for a create); replace it with a recorded fixture once the bench has run (docs/gitlab-bench.md).",
      "request": {"method": method, "path": path, "path_from_docs": bool(url), "body": None},
      "response": {"status": 201 if method == "POST" else 200, "status_from_docs": False, "body": body},
    }
    with open(f"{OUT}/{name}.json", "w") as f:
        json.dump(fx, f, indent=2, ensure_ascii=False)
        f.write("\n")
    print(name, method, path, fx["gitlab"]["tier"], len(json.dumps(body)))
