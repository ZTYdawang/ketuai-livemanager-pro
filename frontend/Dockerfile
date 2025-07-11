# Use an official Node.js runtime as a parent image
FROM node:20-alpine

# Set the working directory in the container
WORKDIR /app

# Copy package.json and package-lock.json (if available)
COPY package*.json ./

# Install app dependencies
RUN npm install

# Copy the rest of the application's source code
# The .dockerignore file will prevent node_modules from being copied
COPY . .

# Make port 3000 available to the world outside this container
EXPOSE 3000

# Run the app when the container launches
# --host 0.0.0.0 is needed to expose the server to the host machine from the container
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "3000"] 