module.exports = {
    apps: [
      {
        name: "wins",
        script: "npm run start",
        env: {
          NODE_ENV: "production",
          PORT: 3000
        }
      }
    ]
};