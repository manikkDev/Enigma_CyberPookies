.PHONY: up down logs health data partitions validate-data vfl-partitions baseline fl fl-dp experiments test
up:
	docker compose up -d --build
down:
	docker compose down
logs:
	docker compose logs -f
health:
	curl --fail http://localhost:8000/health
	curl --fail http://localhost:5002/api/health
	curl --fail http://localhost:5001/health
data:
	cd ml-fl-service && python -m data.download --only paysim_banks && python -m data.features paysim_banks
partitions:
	cd ml-fl-service && python -m data.partition --dataset paysim_banks --clients 5 --mode hfl --seed 42
validate-data:
	cd ml-fl-service && python -m data.validate --dataset paysim_banks --clients 5
vfl-partitions:
	cd ml-fl-service && python -m data.partition --dataset paysim_banks --mode vfl --seed 42
baseline:
	cd ml-fl-service && python -m models.baselines --dataset paysim_banks
fl:
	cd ml-fl-service && flwr run . local-sim --stream
fl-dp:
	cd ml-fl-service && flwr run . local-sim --run-config "dp-enabled=true dp-noise-multiplier=1.0" --stream
experiments:
	cd ml-fl-service && python -m experiments.run_matrix && python -m experiments.report
test:
	cd ml-fl-service && pytest -q
