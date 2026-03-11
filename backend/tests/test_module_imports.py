import importlib

import pytest


@pytest.mark.parametrize(
    "module_name",
    [
        "agent.core",
        "app.main",
        "app.api.v1.articles",
        "app.api.v1.chat",
        "data.repository",
        "retrieval.engine",
    ],
)
def test_modules_are_importable(module_name: str) -> None:
    importlib.import_module(module_name)
