--!strict
local HttpService = game:GetService("HttpService")
local ServerScriptService = game:GetService("ServerScriptService")
local ChangeHistoryService = game:GetService("ChangeHistoryService")

local WS_URL = plugin:GetSetting("StudioSyncUrl") or "ws://localhost:8000/ws/roblox/studio"
local DEFAULT_JOB_ID = plugin:GetSetting("StudioSyncJobId") or "default"

local function injectFiles(files)
    local folder = ServerScriptService:FindFirstChild("TrezzWorld_Generated")
    if not folder then
        folder = Instance.new("Folder")
        folder.Name = "TrezzWorld_Generated"
        folder.Parent = ServerScriptService
    end
    folder:ClearAllChildren()

    for _, file in ipairs(files or {}) do
        local instance = Instance.new(file.className or "Script")
        instance.Name = file.path and file.path:match("[^/]+$") or "GeneratedScript"
        instance.Source = (file.source or file.content or ""):gsub("\\n", "\n")
        instance.Parent = folder
    end

    ChangeHistoryService:SetWaypoint("TrezzWorld Sync")
end

local ws = HttpService:CreateWebStreamClient(Enum.WebStreamClientType.WebSocket, { Url = WS_URL })

ws.MessageReceived:Connect(function(message)
    local ok, data = pcall(HttpService.JSONDecode, HttpService, message)
    if not ok or not data then
        return
    end

    if data.type == "INJECT" then
        injectFiles(data.files)
    elseif data.type == "SYNC" and data.snapshot then
        injectFiles(data.snapshot.files)
    end
end)

ws:Send(HttpService:JSONEncode({
    type = "HELLO",
    jobId = DEFAULT_JOB_ID,
}))
