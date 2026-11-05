-- RELIEFRAIL: Row Level Security Policies
-- Migration 002: RLS Policies

-- Helper function to extract authenticated wallet
CREATE OR REPLACE FUNCTION current_wallet() RETURNS TEXT AS $$
BEGIN
    RETURN NULLIF(current_setting('app.current_wallet', true), '');
END;
$$ LANGUAGE plpgsql STABLE;

-- Helper function to extract user role
CREATE OR REPLACE FUNCTION current_user_role() RETURNS TEXT AS $$
BEGIN
    RETURN NULLIF(current_setting('app.current_role', true), '');
END;
$$ LANGUAGE plpgsql STABLE;

-- Enable RLS
ALTER TABLE organisations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organisation_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE beneficiaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE merchants ENABLE ROW LEVEL SECURITY;
ALTER TABLE allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE vouchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE donations ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- 1. Organisations Policies: Public read; Org admin update
DROP POLICY IF EXISTS orgs_read_policy ON organisations;
CREATE POLICY orgs_read_policy ON organisations FOR SELECT USING (true);

DROP POLICY IF EXISTS orgs_insert_policy ON organisations;
CREATE POLICY orgs_insert_policy ON organisations FOR INSERT WITH CHECK (
    current_wallet() IS NULL OR current_wallet() = wallet_address
);

DROP POLICY IF EXISTS orgs_update_policy ON organisations;
CREATE POLICY orgs_update_policy ON organisations FOR UPDATE USING (
    current_wallet() IS NULL OR current_wallet() = wallet_address
);

-- 2. Campaigns Policies: Public read; Org admin insert/update
DROP POLICY IF EXISTS campaigns_read_policy ON campaigns;
CREATE POLICY campaigns_read_policy ON campaigns FOR SELECT USING (true);

DROP POLICY IF EXISTS campaigns_insert_policy ON campaigns;
CREATE POLICY campaigns_insert_policy ON campaigns FOR INSERT WITH CHECK (
    current_wallet() IS NULL OR EXISTS (
        SELECT 1 FROM organisations o WHERE o.id = org_id AND o.wallet_address = current_wallet()
    )
);

DROP POLICY IF EXISTS campaigns_update_policy ON campaigns;
CREATE POLICY campaigns_update_policy ON campaigns FOR UPDATE USING (
    current_wallet() IS NULL OR EXISTS (
        SELECT 1 FROM organisations o WHERE o.id = org_id AND o.wallet_address = current_wallet()
    )
);

-- 3. Beneficiaries Policies: STRICT PRIVACY!
-- Only the managing organisation can see beneficiary details
DROP POLICY IF EXISTS beneficiaries_policy ON beneficiaries;
CREATE POLICY beneficiaries_policy ON beneficiaries FOR ALL USING (
    current_wallet() IS NULL OR EXISTS (
        SELECT 1 FROM organisations o WHERE o.id = org_id AND o.wallet_address = current_wallet()
    )
);

-- 4. Merchants Policies: Public read; Merchant update own profile
DROP POLICY IF EXISTS merchants_read_policy ON merchants;
CREATE POLICY merchants_read_policy ON merchants FOR SELECT USING (true);

DROP POLICY IF EXISTS merchants_manage_policy ON merchants;
CREATE POLICY merchants_manage_policy ON merchants FOR ALL USING (
    current_wallet() IS NULL OR current_wallet() = wallet_address OR EXISTS (
        SELECT 1 FROM organisations o WHERE o.id = org_id AND o.wallet_address = current_wallet()
    )
);

-- 5. Vouchers Policies: Accessible by managing org, or in sandbox context
DROP POLICY IF EXISTS vouchers_read_policy ON vouchers;
CREATE POLICY vouchers_read_policy ON vouchers FOR SELECT USING (true);

DROP POLICY IF EXISTS vouchers_manage_policy ON vouchers;
CREATE POLICY vouchers_manage_policy ON vouchers FOR ALL USING (
    current_wallet() IS NULL OR EXISTS (
        SELECT 1 FROM campaigns c
        JOIN organisations o ON c.org_id = o.id
        WHERE c.id = campaign_id AND o.wallet_address = current_wallet()
    )
);

-- 6. Redemptions Policies: Public read for transparency; Merchant insert
DROP POLICY IF EXISTS redemptions_read_policy ON redemptions;
CREATE POLICY redemptions_read_policy ON redemptions FOR SELECT USING (true);

DROP POLICY IF EXISTS redemptions_insert_policy ON redemptions;
CREATE POLICY redemptions_insert_policy ON redemptions FOR INSERT WITH CHECK (true);

-- 7. Donations Policies: Public read for transparency
DROP POLICY IF EXISTS donations_read_policy ON donations;
CREATE POLICY donations_read_policy ON donations FOR SELECT USING (true);

DROP POLICY IF EXISTS donations_insert_policy ON donations;
CREATE POLICY donations_insert_policy ON donations FOR INSERT WITH CHECK (true);

-- 8. Audit Events: Universal Public Read for Auditors and Citizens
DROP POLICY IF EXISTS audit_events_read_policy ON audit_events;
CREATE POLICY audit_events_read_policy ON audit_events FOR SELECT USING (true);

DROP POLICY IF EXISTS audit_events_insert_policy ON audit_events;
CREATE POLICY audit_events_insert_policy ON audit_events FOR INSERT WITH CHECK (true);

-- 9. Notifications: Strictly for recipient
DROP POLICY IF EXISTS notifications_policy ON notifications;
CREATE POLICY notifications_policy ON notifications FOR ALL USING (
    current_wallet() IS NULL OR current_wallet() = recipient_wallet
);
