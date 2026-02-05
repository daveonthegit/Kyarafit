package tier

import "strings"

const (
	ANON          = "ANON"
	FREE          = "FREE"
	PREMIUM_BASIC = "PREMIUM_BASIC"
	PREMIUM_PRO   = "PREMIUM_PRO"
)

// Unlimited is the value returned by Limit for unlimited resources.
const Unlimited = -1

// tierOrder for comparison (higher = more capable).
var tierOrder = map[string]int{
	ANON:          0,
	FREE:          1,
	PREMIUM_BASIC: 2,
	PREMIUM_PRO:   3,
}

// Capabilities per tier (code-defined, not DB).
type Capabilities struct {
	WebAccess       bool
	OnlineBackup    bool
	ExportImport    bool   // true = JSON only for BASIC; PRO adds CSV/PDF
	ExportFormats   string // "none" | "json" | "json,csv,pdf"
	MultiDeviceSync bool
	StorageMB       int // -1 = unlimited
	MaxBuilds       int // -1 = unlimited
	MaxConventions  int // -1 = unlimited
}

var capabilities = map[string]Capabilities{
	ANON: {
		WebAccess: false, OnlineBackup: false, ExportImport: false, ExportFormats: "none",
		MultiDeviceSync: false, StorageMB: 0, MaxBuilds: 0, MaxConventions: 0,
	},
	FREE: {
		WebAccess: true, OnlineBackup: false, ExportImport: false, ExportFormats: "none",
		MultiDeviceSync: false, StorageMB: 50, MaxBuilds: 5, MaxConventions: 1,
	},
	PREMIUM_BASIC: {
		WebAccess: true, OnlineBackup: true, ExportImport: true, ExportFormats: "json",
		MultiDeviceSync: true, StorageMB: 500, MaxBuilds: 20, MaxConventions: 5,
	},
	PREMIUM_PRO: {
		WebAccess: true, OnlineBackup: true, ExportImport: true, ExportFormats: "json,csv,pdf",
		MultiDeviceSync: true, StorageMB: Unlimited, MaxBuilds: Unlimited, MaxConventions: Unlimited,
	},
}

// User is the minimal user info needed for tier checks.
type User struct {
	ID             string
	Tier           string
	CurrentUsageMB int
	StorageQuotaMB *int // from subscription if set; else from tier default
}

// Caps returns capabilities for the given tier.
func Caps(t string) Capabilities {
	c, ok := capabilities[t]
	if !ok {
		return capabilities[ANON]
	}
	return c
}

// Can returns true if the user has the given capability.
// Capability names: web_access, online_backup, export_import, multi_device_sync.
func Can(u *User, capability string) bool {
	if u == nil {
		return false
	}
	c := Caps(u.Tier)
	switch strings.ToLower(capability) {
	case "web_access":
		return c.WebAccess
	case "online_backup":
		return c.OnlineBackup
	case "export_import":
		return c.ExportImport
	case "multi_device_sync":
		return c.MultiDeviceSync
	default:
		return false
	}
}

// CanExportFormat returns true if the user can export in the given format (json, csv, pdf).
func CanExportFormat(u *User, format string) bool {
	if u == nil {
		return false
	}
	c := Caps(u.Tier)
	formats := strings.Split(c.ExportFormats, ",")
	for _, f := range formats {
		if strings.TrimSpace(strings.ToLower(f)) == strings.ToLower(format) {
			return true
		}
	}
	return false
}

// Limit returns the numeric limit for the resource: max_builds, max_conventions, storage_mb.
// Returns Unlimited (-1) for no limit.
func Limit(u *User, resource string) int {
	if u == nil {
		return 0
	}
	c := Caps(u.Tier)
	switch strings.ToLower(resource) {
	case "max_builds":
		return c.MaxBuilds
	case "max_conventions":
		return c.MaxConventions
	case "storage_mb":
		if c.StorageMB == Unlimited {
			return Unlimited
		}
		if u.StorageQuotaMB != nil && *u.StorageQuotaMB >= 0 {
			return *u.StorageQuotaMB
		}
		return c.StorageMB
	default:
		return 0
	}
}

// AtLeast returns true if user's tier is at least the given tier.
func AtLeast(u *User, minTier string) bool {
	if u == nil {
		return false
	}
	return tierOrder[u.Tier] >= tierOrder[minTier]
}
