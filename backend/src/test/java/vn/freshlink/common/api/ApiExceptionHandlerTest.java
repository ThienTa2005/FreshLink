package vn.freshlink.common.api;

import org.junit.jupiter.api.Test;
import org.springframework.web.bind.annotation.*;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class ApiExceptionHandlerTest {
    @RestController static class Endpoint {
        @GetMapping("/test") String read(@RequestParam int id) { throw new IllegalStateException("SQL password internal details"); }
        @PostMapping("/test") String write(@RequestBody java.util.Map<String,Object> body) { return "ok"; }
    }
    private final org.springframework.test.web.servlet.MockMvc mvc = MockMvcBuilders
        .standaloneSetup(new Endpoint()).setControllerAdvice(new ApiExceptionHandler()).build();
    @Test void malformedRequestsUseApiEnvelope() throws Exception {
        mvc.perform(get("/test")).andExpect(status().isBadRequest()).andExpect(jsonPath("$.success").value(false));
        mvc.perform(get("/test?id=invalid")).andExpect(status().isBadRequest());
        mvc.perform(post("/test").contentType("application/json").content("{"))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.message").exists());
    }
    @Test void unexpectedFailureDoesNotExposeInternals() throws Exception {
        mvc.perform(get("/test?id=1")).andExpect(status().isInternalServerError())
            .andExpect(jsonPath("$.success").value(false))
            .andExpect(content().string(org.hamcrest.Matchers.not(org.hamcrest.Matchers.containsString("SQL password"))));
    }
}
