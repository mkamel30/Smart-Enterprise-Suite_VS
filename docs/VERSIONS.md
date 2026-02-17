# Versioning Strategy

This project follows **Semantic Versioning (SemVer)** to ensure predictability and stability for both developers and stakeholders.

## 🏷️ Version Format
Versions are expressed as `MAJOR.MINOR.PATCH`:

- **MAJOR**: Breaking changes, significant architectural shifts (e.g., SOA Transition).
- **MINOR**: New features, significant UI updates (e.g., Maintenance Center Integration).
- **PATCH**: Bug fixes, security updates, and minor documentation tweaks.

## 🚀 Current Stable Release
- **System Version**: `v3.5.1`
- **Documentation Version**: `v1.3.1`

## 📦 Lifecycle Stages

| Stage | Description | Git Tag Pattern |
|-------|-------------|-----------------|
| **Development** | Active work in progress | `vX.X.X-dev` |
| **Beta** | Feature complete, needs testing | `vX.X.X-beta` |
| **Release** | Stable production-ready version | `vX.X.X` |

## 🛠️ How to Version
1.  **Tagging**: Use Git tags for every release: `git tag -a v2.1.0 -m "Release v2.1.0"`.
2.  **Updating**: Always update this file and `CHANGELOG.md` before merging to the main branch.
3.  **Doc Matching**: Documentation versions should mirror the core system versioning for consistency.

---
*Last Updated: 2026-02-18*
