FROM node:22-slim

WORKDIR /app

RUN corepack enable

COPY package.json yarn.lock .yarnrc.yml ./

RUN yarn install --immutable

COPY . .

EXPOSE 5173

CMD ["yarn", "start", "--host", "0.0.0.0"]
