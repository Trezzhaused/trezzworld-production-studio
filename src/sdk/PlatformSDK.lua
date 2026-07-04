--!strict
local PlatformSDK = {}
PlatformSDK.__index = PlatformSDK

function PlatformSDK.init(apiKey: string)
    local self = setmetatable({}, PlatformSDK)
    self.ApiKey = apiKey
    return self
end

function PlatformSDK:GetActiveEvent()
    return {
        name = "Seasonal LiveOps",
        status = "active",
    }
end

function PlatformSDK:LoadFranchiseProgression(player: Player, franchiseId: string)
    return {
        franchiseId = franchiseId,
        player = tostring(player.UserId),
        status = "loaded",
    }
end

function PlatformSDK:LogEvent(eventName: string, payload: any)
    return {
        eventName = eventName,
        payload = payload,
        status = "logged",
    }
end

return PlatformSDK
