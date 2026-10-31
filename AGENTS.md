# Workspace Instructions: CampusConnect

## Git Identity & Credentials Policy

For this project and repository, all Git operations MUST strictly use the following credentials and repository settings:

- **Target Repository:** `https://github.com/sakib-cse54/cammpus-connect.git`
- **Code Directory:** `codes/`
- **GitHub Username:** `sakib-cse54`
- **Email:** `capstone.shakib.and69others@gmail.com`
- **Credentials Storage:** Configured locally in `codes/.git/config` and `.env.credentials` (never commit raw token strings).

### Invariants:
1. **Never use "4xrhd":** Do NOT use the machine's global account `4xrhd`.
2. **Credential Helper Isolation:** Ensure local `credential.helper` is disabled in `codes/.git/config` so Git does not invoke `/usr/bin/gh auth git-credential`.
3. **Commit & Push Scope:** All code commits and pushes must occur inside the `codes/` folder pointing to `origin main` on `sakib-cse54/cammpus-connect`.
