# E2E Test Report

**Date:** {{DATE}}
**Duration:** {{DURATION}}
**Status:** {{STATUS}}
**Environment:** {{ENVIRONMENT}}
**Playwright Version:** {{PLAYWRIGHT_VERSION}}

## Summary
| Metric | Count | Percentage |
|--------|-------|------------|
| Total Tests | {{TOTAL}} | 100% |
| Passed | {{PASSED}} | {{PASSED_PERCENT}}% |
| Failed | {{FAILED}} | {{FAILED_PERCENT}}% |
| Flaky | {{FLAKY}} | {{FLAKY_PERCENT}}% |
| Skipped | {{SKIPPED}} | {{SKIPPED_PERCENT}}% |

## Test Results by Module

### OCR 主页面
| Test Case | Status | Duration |
|-----------|--------|----------|
{{OCR_TESTS}}

### 图片标注页面
| Test Case | Status | Duration |
|-----------|--------|----------|
{{ANNOTATE_TESTS}}

### 演示页面
| Test Case | Status | Duration |
|-----------|--------|----------|
{{DEMO_TESTS}}

### 集成流程
| Test Case | Status | Duration |
|-----------|--------|----------|
{{INTEGRATION_TESTS}}

## Failed Tests Details
{{FAILED_TESTS_DETAILS}}

## Flaky Tests Details
{{FLAKY_TESTS_DETAILS}}

## Performance Metrics
- Average page load time: {{AVG_PAGE_LOAD}}ms
- Average image load time: {{AVG_IMAGE_LOAD}}ms
- Average recognition time: {{AVG_RECOGNITION_TIME}}ms

## Artifacts
- 📊 HTML Report: [artifacts/playwright-report/index.html](artifacts/playwright-report/index.html)
- 🖼️ Screenshots: [artifacts/*.png](artifacts/)
- 🎥 Videos: [artifacts/videos/*.webm](artifacts/videos/)
- 📝 Traces: [artifacts/*.zip](artifacts/)

## Recommendations
{{RECOMMENDATIONS}}
