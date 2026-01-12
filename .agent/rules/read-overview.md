---
trigger: always_on
glob: "*"
description: "Instructions to check project documentation for environment setup and task execution contexts."
---

# Project Context and Documentation

When executing tasks or starting a session, YOU MUST:
1.  **Scan for Documentation**: Look in the root directory and the `.dev/` directory for files like `README.md`, `ARCHITECTURE.md`, `DEV_LOG.md`, or similar.
2.  **Understand Environment**: Use this documentation to determine necessary runtime environments, such as whether a local server (e.g., `python3 -m http.server`) is required to run the application (especially for ES module based projects).
3.  **Apply Guidelines**: Follow any architectural patterns or dev guidelines found in these documents.

Always verify if a specific setup (like a python server) is needed before trying to open the app directly.
