.PHONY: help
help:
	@echo "Please use \`make <target>' where <target> is one of"
	@echo "  build       to build the extension"
	@echo "  clean       to clean the build artifacts"

.PHONY: clean
clean:
	rm -rf dist/ releases/

.PHONY: build
build:
	NODE_ENV=production BROWSER=chrome webpack --progress --config webpack.config.js
	web-ext build -o --source-dir=./dist/chrome/prod --artifacts-dir=./releases/chrome
	NODE_ENV=production BROWSER=firefox webpack --progress --config webpack.config.js
	web-ext build -o --source-dir=./dist/firefox/prod --artifacts-dir=./releases/firefox
