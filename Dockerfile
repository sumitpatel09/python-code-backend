# Use an official Node.js image
FROM node:18

# Install Python 3
RUN apt-get update && \
    apt-get install -y python3 python3-pip && \
    apt-get clean

# Create app directory
WORKDIR /usr/src/app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of the app
COPY . .

# Expose port
EXPOSE 3001

# Run the backend
CMD ["npm", "start"]
