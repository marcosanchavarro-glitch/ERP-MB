export async function grantRuntime(pool,role){
 if(!/^[a-z][a-z0-9_]{0,62}$/.test(role))throw new Error('Invalid runtime role');
 await pool.query(`GRANT USAGE ON SCHEMA public TO ${role};
 GRANT SELECT,INSERT,UPDATE ON people TO ${role};
 GRANT SELECT,INSERT ON person_events TO ${role};
 GRANT SELECT,INSERT,UPDATE ON cells,cell_memberships TO ${role};
 GRANT SELECT,INSERT ON cell_events,cell_operations TO ${role};
 GRANT SELECT,INSERT ON cell_schedules,meeting_events TO ${role};
 GRANT SELECT,INSERT,UPDATE ON cell_meetings,meeting_attendance TO ${role};
 GRANT SELECT,INSERT,UPDATE ON followup_metrics,followup_alerts,followup_cases TO ${role};
 GRANT SELECT,INSERT ON followup_events,followup_interventions TO ${role};
 GRANT SELECT,INSERT,DELETE ON followup_dirty TO ${role};
 GRANT SELECT ON attendance_states TO ${role};
 GRANT SELECT,INSERT,UPDATE ON newcomers,newcomer_referrals,newcomer_attendance,welcome_coffees,welcome_guests TO ${role};
 GRANT SELECT,INSERT ON newcomer_events TO ${role};
 GRANT SELECT,INSERT,UPDATE ON appointments,appointment_recipients TO ${role};
 GRANT SELECT,INSERT ON appointment_events TO ${role};
 GRANT SELECT ON newcomer_progress TO ${role};
 GRANT INSERT ON audit_events TO ${role};
 GRANT SELECT,INSERT,UPDATE ON users TO ${role};
 GRANT SELECT ON roles,permissions,role_permissions,identity_audit TO ${role};
 GRANT SELECT,INSERT,DELETE ON user_roles,user_permissions TO ${role};
 GRANT SELECT,INSERT,UPDATE,DELETE ON sessions TO ${role};
 GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA public TO ${role};`);
}
