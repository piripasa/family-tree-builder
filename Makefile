.DEFAULT_GOAL := help

.PHONY: help build up down restart logs ps test

help:
	@printf '%s\n' \
		'build    Build the app image' \
		'up       Start the app and Postgres' \
		'down     Stop the app and Postgres' \
		'restart  Stop, rebuild, and start' \
		'logs     Follow container logs' \
		'ps       Show container status' \
		'test     Run the unit tests' \
		'' \
		'The app listens on port 3000. Postgres listens on port 5434.'

build:
	docker compose build

up:
	docker compose up --build -d

down:
	docker compose down

restart: down up

logs:
	docker compose logs -f

ps:
	docker compose ps

test:
	npm test
