FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /app
COPY pom.xml .
RUN mvn --batch-mode dependency:go-offline
COPY src ./src
RUN mvn --batch-mode clean package -DskipTests

FROM eclipse-temurin:17-jre
WORKDIR /app
RUN useradd --system --uid 1001 freshlink
COPY --from=build /app/target/freshlink-api-*.jar app.jar
USER freshlink
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
