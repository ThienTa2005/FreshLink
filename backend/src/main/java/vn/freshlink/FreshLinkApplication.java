package vn.freshlink;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication(exclude=org.springframework.boot.autoconfigure.security.servlet.UserDetailsServiceAutoConfiguration.class)
@org.springframework.scheduling.annotation.EnableScheduling
public class FreshLinkApplication {
    public static void main(String[] args) {
        SpringApplication.run(FreshLinkApplication.class, args);
    }
}
