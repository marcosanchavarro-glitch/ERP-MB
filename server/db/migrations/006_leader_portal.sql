-- An administrative account opt-in, not a global grant over Cells/People/Attendance.
INSERT INTO permissions(key) VALUES ('lider.portal');
INSERT INTO roles(id,name) VALUES(gen_random_uuid(),'Portal líder');
INSERT INTO role_permissions(role_id,permission) SELECT id,'lider.portal' FROM roles WHERE name='Portal líder';
-- No users or associations are created here. Current LEADER membership is the scope source.
