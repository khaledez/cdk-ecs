FROM node:alpine

# Copy package.json and package-lock.json
COPY package*.json ./

# Install npm production packages 
RUN npm install --production
WORKDIR /opt/app-root/src 
COPY . /opt/app-root/src

ENV NODE_ENV production
ENV PORT 80

EXPOSE 80

CMD ["npm", "start"]