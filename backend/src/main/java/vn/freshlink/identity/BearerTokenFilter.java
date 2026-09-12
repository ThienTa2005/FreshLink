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
            var authenticated = identity.authenticate(header.substring(7));
            if (authenticated.isPresent()) {
                Actor actor = authenticated.get();
                String workspace = req.getHeader("X-Organization-Id");
                if (workspace != null && !req.getRequestURI().equals("/api/auth/me")) {
                    long organization;
                    try { organization = Long.parseLong(workspace); }
                    catch (NumberFormatException e) { res.sendError(400, "Đơn vị không hợp lệ"); return; }
                    var memberships = actor.memberships().stream().filter(m -> m.organizationId() == organization).toList();
                    if (memberships.isEmpty()) { res.sendError(403, "Không có quyền truy cập đơn vị"); return; }
                    actor = new Actor(actor.userId(), actor.email(), actor.fullName(), memberships);
                } else if (workspace == null && actor.memberships().size() > 1 && !req.getRequestURI().startsWith("/api/auth/")) {
                    actor = new Actor(actor.userId(), actor.email(), actor.fullName(), java.util.List.of(actor.memberships().get(0)));
                }
                var authorities = actor.memberships().stream().flatMap(m -> m.roles().stream()).distinct()
                    .map(r -> new SimpleGrantedAuthority("ROLE_" + r)).toList();
                var context = SecurityContextHolder.createEmptyContext();
                context.setAuthentication(new UsernamePasswordAuthenticationToken(actor, null, authorities));
                SecurityContextHolder.setContext(context);
            }
        }
        chain.doFilter(req, res);
    }
}
