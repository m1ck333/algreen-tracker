# Backend Flag: Tablet DTO Enhancements

> Based on analysis of the original AlGreen Excel Master v3 workbook and comparison with current backend DTOs.
> Frontend is ready to consume these fields once added.

---

## Change 1: Add Special Request Names to Tablet DTOs

### Why
In the Excel, every process sheet shows the order's special requests (e.g., "Peskarenje", "Samo farbanje") so workers know how to handle the item. Currently the tablet DTOs don't include this information, so workers on the tablet have no visibility into special requests.

### What to change

**1a. Add `SpecialRequestNames` to all 3 tablet DTOs:**

```csharp
// TabletQueueItemDto.cs — add at the end
List<string> SpecialRequestNames

// TabletActiveWorkDto.cs — add at the end (before SubProcesses)
List<string> SpecialRequestNames

// TabletIncomingDto.cs — add at the end (before BlockingProcesses)
List<string> SpecialRequestNames
```

**1b. Eager-load SpecialRequests in the repository:**

File: `OrderRepository.cs` → `GetActiveOrdersWithProcessesAsync`

```csharp
// Current (line 66-68):
.Include(o => o.Items)
    .ThenInclude(i => i.Processes)
        .ThenInclude(p => p.SubProcesses)

// Add after Processes include:
.Include(o => o.Items)
    .ThenInclude(i => i.Processes)
        .ThenInclude(p => p.SubProcesses)
.Include(o => o.Items)                    // ← NEW
    .ThenInclude(i => i.SpecialRequests)  // ← NEW
```

**1c. Resolve special request type names in the query handlers:**

The tricky part: `OrderItemSpecialRequest` only stores `SpecialRequestTypeId` (a `Guid`). The `SpecialRequestType` entity (with `Name`) lives in the **Production module**. Options:

- **Option A (recommended)**: Inject `ISpecialRequestTypeRepository` into the 3 tablet query handlers. Load all active types for the tenant once at the start of the handler, build a `Dictionary<Guid, string>` lookup. Then after `Adapt<>()`, set `SpecialRequestNames` from the item's `SpecialRequests` collection:

```csharp
// In each handler, after Adapt:
var specialRequestNames = item.SpecialRequests
    .Select(sr => specialRequestTypeLookup.GetValueOrDefault(sr.SpecialRequestTypeId, ""))
    .Where(name => !string.IsNullOrEmpty(name))
    .ToList();

var dto = process.Adapt<TabletQueueItemDto>() with { SpecialRequestNames = specialRequestNames };
```

- **Option B**: Add a cross-module query/service that resolves type IDs to names.

### Data flow
```
OrderItem.SpecialRequests → [SpecialRequestTypeId]
  → lookup SpecialRequestType.Name
    → List<string> in DTO
```

---

## Change 2: Add Order Completion Progress to Tablet DTOs

### Why
In the Excel's Master tabela, the overall order status shows a completion ratio (e.g., "6/11 completed"). Workers benefit from knowing how far along the overall order is — it helps prioritize and gives context about urgency. Currently the tablet only shows the status of the current process.

### What to change

**2a. Add two `int` fields to all 3 tablet DTOs:**

```csharp
// Add to TabletQueueItemDto, TabletActiveWorkDto, TabletIncomingDto:
int CompletedProcessCount
int TotalProcessCount
```

**2b. Compute in query handlers:**

After the `Adapt<>()` call, set the counts from `item.Processes`:

```csharp
var completedCount = item.Processes.Count(p =>
    p.Status == ProcessStatus.Completed || p.Status == ProcessStatus.Withdrawn);
var totalCount = item.Processes.Count(p => !p.IsWithdrawn);

var dto = process.Adapt<TabletQueueItemDto>() with
{
    CompletedProcessCount = completedCount,
    TotalProcessCount = totalCount
};
```

This is purely computed from data already loaded (no additional queries needed).

---

## Summary of files to modify

| File | Change |
|------|--------|
| `DTOs/Tablet/TabletQueueItemDto.cs` | Add `SpecialRequestNames`, `CompletedProcessCount`, `TotalProcessCount` |
| `DTOs/Tablet/TabletActiveWorkDto.cs` | Add `SpecialRequestNames`, `CompletedProcessCount`, `TotalProcessCount` |
| `DTOs/Tablet/TabletIncomingDto.cs` | Add `SpecialRequestNames`, `CompletedProcessCount`, `TotalProcessCount` |
| `Repositories/OrderRepository.cs` | Add `.ThenInclude(i => i.SpecialRequests)` to eager loading |
| `Queries/Tablet/GetTabletQueue/GetTabletQueueQueryHandler.cs` | Inject `ISpecialRequestTypeRepository`, resolve names, compute progress |
| `Queries/Tablet/GetTabletActiveWork/GetTabletActiveWorkQueryHandler.cs` | Same |
| `Queries/Tablet/GetTabletIncoming/GetTabletIncomingQueryHandler.cs` | Same |

No new endpoints needed. No controller changes. Just DTO expansion + handler enrichment.
