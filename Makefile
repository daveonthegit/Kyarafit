.PHONY: run-backend install dev-web dev-mobile docker-up

install:
	npm install

docker-up:
	docker-compose up -d

run-backend:
	cd backend && go run ./cmd/api

dev-web:
	npm run dev:web

dev-mobile:
	npm run dev:mobile
