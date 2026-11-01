.PHONY: install validate clean

install:
	pnpm install

validate:
	@if [ -f report.json ]; then node validate-report.js report.json; else echo "No report.json found; skipping single report validation."; fi
	@if [ -d reports ]; then node validate-dir.js ./reports --output validation-summary.json --summary-output report-summary.json --markdown-output report-summary.md; else echo "No ./reports directory found; skipping batch validation."; fi

clean:
	rm -f validation-summary.json report-summary.json report-summary.md report-diff.md
