package vn.freshlink.identity;

import java.io.IOException;
import jakarta.servlet.*;
import jakarta.servlet.http.*;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

public class BearerTokenFilter extends OncePerRequestFilter {
    private final IdentityService identity;
    public BearerTokenFilter(IdentityService identity) { this.identity = identity; }
    @Override protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain) throws ServletException, IOException {
        String header = req.getHeader("Authorization");
        if (header != null && header.startsWith("Bearer ")) {
            identity.authenticate(header.substring(7)).ifPresent(actor -> {
                var authorities = actor.memberships().stream().flatMap(m -> m.roles().stream()).distinct()
                    .map(r -> new SimpleGrantedAuthority("ROLE_" + r)).toList();
                var context = SecurityContextHolder.createEmptyContext();
                context.setAuthentication(new UsernamePasswordAuthenticationToken(actor, null, authorities));
                SecurityContextHolder.setContext(context);
            });
        }
        chain.doFilter(req, res);
    }
}
