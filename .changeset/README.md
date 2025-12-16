# Changesets

This directory contains changeset files that describe changes to packages in this monorepo.

## Creating a Changeset

To create a changeset, run:

```bash
pnpm changeset
```

This will prompt you to:

1. Select which packages have changed
2. Choose the type of change (major, minor, patch)
3. Write a description of the change

## Versioning

To version packages based on changesets:

```bash
pnpm version
```

This will:

- Update package versions
- Generate CHANGELOG files
- Remove used changeset files

## Publishing

To publish packages:

```bash
pnpm release
```

This will build all packages and publish them to npm (if configured).
