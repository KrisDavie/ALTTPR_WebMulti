FROM node:lts-alpine

ENV HOST=0.0.0.0
WORKDIR /usr/src/app

RUN chown -R node /usr/src/app

USER node

COPY --chown=node:node package*.json ./
RUN npm install

# RUN chown -R node /app

COPY --chown=node:node ./src ./src
COPY --chown=node:node ./static ./static

# RUN ls -laR /usr/src/app

CMD ["npm", "start"]