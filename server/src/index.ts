import "reflect-metadata";
import { createConnection } from "typeorm";
import dotenv from "dotenv";
import { COOKIE_NAME, __prod__ } from "./constants";
import { Post } from "./entities/Post";
import path from "path";
import express from "express";
import { ApolloServer } from "apollo-server-express";
import { buildSchema } from "type-graphql";
import { HelloResolver } from "./resolvers/hello";
import { PostResolver } from "./resolvers/post";
import { Users } from "./entities/user";
import { UserResolver } from "./resolvers/user";
import redis from "redis";
import session from "express-session";
import connectRedis from "connect-redis";
import { MyContext } from "./types";
import { ApolloServerPluginLandingPageGraphQLPlayground } from "apollo-server-core";
import cors from "cors";
import { sendEmail } from "./utils/sendEmail";

dotenv.config();

const main = async () => {
  const conn = await createConnection({
    type: "postgres",
    host: "localhost",
    port: 5432,
    username: process.env.DBUSERNAME,
    password: process.env.PASSWORD,
    database: "socialmedia",
    logging: !__prod__,
    // synchronize: true,
    migrations: [path.join(__dirname, "./migrations/*")],
    entities: [Post, Users],
  });

  const app = express();

  const RedisStore = connectRedis(session);

  const redisClient = redis.createClient({
    port: 6379,
    host: "localhost",
  });

  redisClient.on("error", function (err) {
    console.log("Could not establish a connection with redis. " + err);
  });
  redisClient.on("connect", function () {
    console.log("Connected to redis successfully");
  });

  app.use(
    cors({
      origin: "http://localhost:3000",
      credentials: true,
    })
  );
  app.use(
    session({
      name: COOKIE_NAME,
      store: new RedisStore({
        client: redisClient,
        disableTouch: true,
      }),
      cookie: {
        maxAge: 1000 * 60 * 60 * 24 * 365 * 10, //10 years
        httpOnly: true,
        sameSite: "lax", //protects for csrf
        secure: __prod__, //cookie only works in https
      },
      saveUninitialized: false,
      secret: "ghskhurrjbbfrytytgrshjk",
      resave: false,
    })
  );

  const apolloServer = new ApolloServer({
    plugins: [ApolloServerPluginLandingPageGraphQLPlayground()],
    schema: await buildSchema({
      resolvers: [HelloResolver, PostResolver, UserResolver],
      validate: false,
    }),
    context: ({ req, res }): MyContext => ({ req, res }),
  });

  await apolloServer.start();

  apolloServer.applyMiddleware({
    app,
    cors: false,
    //false because we are setting global cors instead
  });

  app.listen(4000, () => {
    console.log("Server started on port 4000");
  });
};

main().catch((err) => console.log(err));
