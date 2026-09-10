package vn.freshlink.identity;

import jakarta.persistence.*;

@Entity
@Table(name = "users")
public class Account {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "user_id") public Long id;
    @Column(nullable = false,length=150) public String email;
    @Column(name = "password_hash", nullable = false) public String passwordHash;
    @Column(name = "full_name", nullable = false,length=150) public String fullName;
    public enum Status { PENDING, ACTIVE, LOCKED, DISABLED }
    @Enumerated(EnumType.STRING) @Column(nullable = false) public Status status;
    protected Account() {}
}
