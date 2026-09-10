package vn.freshlink.common;

import java.sql.Statement;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.stereotype.Component;

@Component
public class Sql {
    private final JdbcTemplate jdbc;
    public Sql(JdbcTemplate jdbc) { this.jdbc = jdbc; }
    public long insert(String query, Object... values) {
        var keys = new GeneratedKeyHolder();
        jdbc.update(connection -> {
            var statement = connection.prepareStatement(query, Statement.RETURN_GENERATED_KEYS);
            for (int i = 0; i < values.length; i++) statement.setObject(i + 1, values[i]);
            return statement;
        }, keys);
        return java.util.Objects.requireNonNull(keys.getKey()).longValue();
    }
}
