FROM python:3.12-slim-bullseye as build

RUN apt-get update \
    && apt-get -y install libpq-dev gcc git

ENV PYTHONDONTWRITEBYTECODE=1

RUN pip install poetry

WORKDIR /app

COPY pyproject.toml poetry.lock ./

ARG GITHUB_PAT
RUN poetry config virtualenvs.in-project true && poetry install --no-root --no-interaction

COPY . .

# RUN poetry run prospector && poetry run pytest
RUN poetry install --no-interaction


FROM python:3.12-slim-bullseye

RUN apt-get update \
    && apt-get -y install libpq-dev gcc git


# Keeps Python from generating .pyc files in the container
ENV PYTHONDONTWRITEBYTECODE=1
# Turns off buffering for easier container logging
ENV PYTHONUNBUFFERED=1

RUN mkdir /app

# COPY --from=build /app/.venv /app/.venv/
COPY --from=build /app/ /app/

# COPY hypercorn_config.toml /app/hypercorn_config.toml

RUN adduser -u 5678 --disabled-password --gecos "" appuser
RUN chown -R appuser /app
USER appuser

CMD /app/.venv/bin/uvicorn main:app --reload