# Git Repository Credentials and Push Standard Rule

This rule defines the mandatory Git authentication, identity, and push configuration for the CampusConnect project.

## 1. Mandatory Identity and Credentials

For all Git commits, tags, branches, and pushes within this project:
- **GitHub Username:** `sakib-cse54`
- **User Email:** `capstone.shakib.and69others@gmail.com`
- **Target Repository:** `https://github.com/sakib-cse54/cammpus-connect.git`
- **Code Directory:** `/home/tr/Desktop/project/sakib/codes`
- **Credentials Storage:** Configured locally in `codes/.git/config` and `.env.credentials` (never commit raw token strings).

## 2. Absolute Prohibition Against Host Account "4xrhd"

- **Prohibition:** NEVER use the machine's global GitHub account `4xrhd` or email `65583096+4xrhd@users.noreply.github.com` for this project.
- **Credential Helper Isolation:** Local Git configuration in `codes/` MUST always clear the credential helper (`credential.helper = ""` and `credential.https://github.com.helper = ""`) so Git never invokes `/usr/bin/gh auth git-credential` (which defaults to `4xrhd`).

## 3. Mandatory Push and Commit Protocol

Whenever the user asks to commit or push changes:
1. Navigate to the `codes/` directory.
2. Verify local Git identity:
   ```bash
   git config user.name "sakib-cse54"
   git config user.email "capstone.shakib.and69others@gmail.com"
   ```
3. Stage project code while strictly honoring `.gitignore` (never commit `node_modules`, `dist`, `.env*`, or database files).
4. Commit with descriptive messages using standard short hyphens (-), colons (:), or pipes (|).
5. Push to `origin main` using the locally configured remote origin:
   ```bash
   git push origin main
   ```
