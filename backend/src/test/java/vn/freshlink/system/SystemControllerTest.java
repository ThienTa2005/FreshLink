package vn.freshlink.system;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.web.servlet.MockMvc;
import vn.freshlink.config.SecurityConfig;
import vn.freshlink.config.WebConfig;

@WebMvcTest(SystemController.class)
@Import({SecurityConfig.class, WebConfig.class})
class SystemControllerTest {
    @org.springframework.test.context.bean.override.mockito.MockitoBean
    private vn.freshlink.identity.IdentityService identity;
    @Autowired
    private MockMvc mockMvc;

    @Test
    void healthEndpointIsPublic() throws Exception {
        mockMvc.perform(get("/api/public/health"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.success").value(true))
            .andExpect(jsonPath("$.data.status").value("UP"));
    }

    @Test
    void corsPreflightWorksForVercelOrigin() throws Exception {
        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options("/api/public/health")
                .header("Origin", "https://fresh-link-eight.vercel.app")
                .header("Access-Control-Request-Method", "GET")
                .header("Access-Control-Request-Headers", "X-Request-Id,Authorization,Content-Type"))
            .andExpect(status().isOk())
            .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.header().string("Access-Control-Allow-Origin", "https://fresh-link-eight.vercel.app"))
            .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.header().string("Access-Control-Allow-Credentials", "true"));
    }

    @Test
    void corsGetWorksForVercelOrigin() throws Exception {
        mockMvc.perform(get("/api/public/health")
                .header("Origin", "https://fresh-link-eight.vercel.app")
                .header("X-Request-Id", "test-trace-123"))
            .andExpect(status().isOk())
            .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.header().string("Access-Control-Allow-Origin", "https://fresh-link-eight.vercel.app"))
            .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.header().string("Access-Control-Allow-Credentials", "true"));
    }
}
