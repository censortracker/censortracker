SHELL:=/usr/bin/env bash

.PHONY: build
build:
	npm run dev


.PHONY: test
test:
	npm run test


.PHONY: lint
lint:
	npm run lint:fix

