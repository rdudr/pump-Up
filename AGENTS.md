<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Formulas

Every calculated value comes from `lib/pump-calc.ts`, which copies the
original *Pump Analysis* workbook. After changing it, run `npm run test:calc`.

## PostMan (KISEM report generator)

This app's export feeds the KISEM **PostMan** report generator. Before
changing an export column, a sheet or a formula, read `docs/POSTMAN_IMPORT.md` — and push every
repository touched (this one and `rdudr/PostMAN`) before calling the work
done.
