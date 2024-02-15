.PHONY: help
help:
	@echo "Please use \`make <target>' where <target> is one of"
	@echo "  chrome       to build the extension for Chrome"
	@echo "  firefox      to build the extension for Firefox"
	@echo "  clean        to clean the build artifacts"

.PHONY: clean
clean:
	rm -rf dist/ releases/

.PHONY: chrome
chrome:
	npm run build:chrome:prod

.PHONY: ff
ff:
	npm run build:firefox:prod
