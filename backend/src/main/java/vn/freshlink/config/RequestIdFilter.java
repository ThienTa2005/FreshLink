package vn.freshlink.config;

import jakarta.servlet.*;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.MDC;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.UUID;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class RequestIdFilter extends OncePerRequestFilter {

    public static final String REQUEST_ID_HEADER = "X-Request-Id";
    public static final String MDC_KEY_REQUEST_ID = "requestId";
    public static final String MDC_KEY_IP = "clientIp";

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        String requestId = request.getHeader(REQUEST_ID_HEADER);
        if (requestId == null || requestId.isBlank()) {
            requestId = UUID.randomUUID().toString();
        }

        String clientIp = request.getHeader("X-Forwarded-For");
        if (clientIp == null || clientIp.isBlank()) {
            clientIp = request.getRemoteAddr();
        } else if (clientIp.contains(",")) {
            clientIp = clientIp.split(",")[0].trim();
        }

        response.setHeader(REQUEST_ID_HEADER, requestId);
        MDC.put(MDC_KEY_REQUEST_ID, requestId);
        MDC.put(MDC_KEY_IP, clientIp);

        try {
            filterChain.doFilter(request, response);
        } finally {
            MDC.remove(MDC_KEY_REQUEST_ID);
            MDC.remove(MDC_KEY_IP);
            MDC.remove("userId");
            MDC.remove("userEmail");
            MDC.remove("organizationId");
            MDC.remove("roles");
        }
    }
}
