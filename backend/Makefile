.PHONY: dev test test-all test-cov clean test-variant test-completion test-feature test-integration

dev:
	uvicorn src.main:app --reload

test-all:
	python -m pytest

# Run specific test module (usage: make test TEST=src.core.tests.test_variant_manager)
test:
	python -m pytest $(TEST) -v


test-variant:
	python -m pytest src/core/tests/test_variant_manager.py -v

test-completion:
	python -m pytest src/core/tests/test_completion_service.py -v

test-feature:
	python -m pytest src/core/tests/test_feature_service.py -v

test-integration:
	python -m pytest src/core/tests/test_integration.py -v

# Run tests with coverage report
test-cov:
	python -m pytest --cov=src

# Clean Python cache files
clean:
	find . -type d -name "__pycache__" -exec rm -rf {} +
	find . -type f -name "*.pyc" -delete
	find . -type d -name ".pytest_cache" -exec rm -rf {} +
	find . -type d -name ".coverage" -exec rm -rf {} +