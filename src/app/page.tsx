"use client";

import React, { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ArrowUpDown, Plane, Ship, Truck, Leaf, Search } from "lucide-react";
import { motion } from "framer-motion";

// --- helpers (placeholder logic for MVP demo) ---
const SERVICE_LEVELS = [
  { id: "express", label: "Express (1-3 days)", speed: 3, multiplier: 2.1 },
  { id: "standard", label: "Standard (3-7 days)", speed: 6, multiplier: 1.2 },
  { id: "economy", label: "Economy (7-14 days)", speed: 10, multiplier: 1.0 },
];

const MODES = [
  { id: "air", label: "Air", icon: Plane, emissionFactor: 500 }, // g CO2e per ton-km (illustrative)
  { id: "ocean", label: "Ocean", icon: Ship, emissionFactor: 16 },
  { id: "road", label: "Road", icon: Truck, emissionFactor: 120 },
]; 

// types
type ModeId = "air" | "ocean" | "road";
type ServiceId = "express" | "standard" | "economy";
type SortKey = "price" | "eta" | "co2";
interface Quote {
  carrier: string;
  price: number;
  etaDays: number;
  co2e: number;
  mode: ModeId;
  service: ServiceId;
}

const CARRIERS: Record<ModeId, string[]> = {
  air: ["DHL Express", "FedEx", "UPS", "Maersk Air Cargo"],
  ocean: ["Maersk", "MSC", "CMA CGM", "Hapag-Lloyd"],
  road: ["XPO", "Schneider", "JB Hunt", "Old Dominion"],
};

function estimateBaseRate(kg: number, volumeM3: number, distanceKm: number, multiplier: number, mode: ModeId) {
  const densityAdj = Math.max(kg / (volumeM3 * 167 || 1), 0.6); // basic dim weight adjustment
  const modeAdj = mode === "air" ? 1.8 : mode === "ocean" ? 0.4 : 1.0;
  const distanceAdj = Math.log(distanceKm + 20) / 5; // diminishing effect
  const price = (kg * 0.8 + volumeM3 * 50) * multiplier * modeAdj * distanceAdj * densityAdj + 50;
  return Math.max(Math.round(price), 25);
}

function estimateDistanceKm(origin: string, destination: string) {
  // placeholder distance: length difference * 120 + 800 – just for demo
  if (!origin || !destination) return 0;
  const diff = Math.abs(origin.length - destination.length);
  return 800 + diff * 120 + Math.abs(origin.charCodeAt(0) - destination.charCodeAt(0)) * 5;
}

function estimateTransitDays(distanceKm: number, mode: ModeId, speedHintDays: number) {
  const base = distanceKm / (mode === "air" ? 2000 : mode === "ocean" ? 600 : 700);
  return Math.ceil(Math.max(base, speedHintDays * 0.6));
}

function estimateCO2eKg(mode: ModeId, distanceKm: number, weightKg: number) {
  const modeDef = MODES.find((m) => m.id === mode)!;
  const tonKm = (weightKg / 1000) * distanceKm;
  return Math.round((modeDef.emissionFactor * tonKm) / 1000); // kg CO2e
}

function currency(n: number) {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

// --- UI ---
export default function FreightCompareApp() {
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [mode, setMode] = useState<ModeId>("air");
  const [service, setService] = useState<ServiceId>("standard");
  const [weight, setWeight] = useState<number>(100);
  const [length, setLength] = useState<number>(120);
  const [width, setWidth] = useState<number>(80);
  const [height, setHeight] = useState<number>(60);
  const [sortBy, setSortBy] = useState<SortKey>("price");
  const [maxPrice, setMaxPrice] = useState<number>(5000);
  const [onlyGreen, setOnlyGreen] = useState<boolean>(false);

  const volumeM3 = useMemo(() => (length * width * height) / 1e6, [length, width, height]);
  const distanceKm = useMemo(() => estimateDistanceKm(origin, destination), [origin, destination]);
  const serviceMeta = SERVICE_LEVELS.find((s) => s.id === service)!;

  const quotes = useMemo<Quote[]>(() => {
    if (!origin || !destination) return [];
    const carriers = CARRIERS[mode];
    return carriers.map((name, idx) => {
      const base = estimateBaseRate(weight, volumeM3, distanceKm, serviceMeta.multiplier * (1 + idx * 0.05), mode);
      const etaDays = estimateTransitDays(distanceKm, mode, serviceMeta.speed) + idx;
      const co2e = estimateCO2eKg(mode, distanceKm, weight) * (1 + idx * 0.03);
      return {
        carrier: name,
        price: base,
        etaDays,
        co2e: Math.round(co2e),
        mode,
        service,
      };
    });
  }, [origin, destination, mode, volumeM3, weight, distanceKm, serviceMeta, service]);

  const filteredSorted = useMemo<Quote[]>(() => {
    let rows = quotes.filter((q) => q.price <= maxPrice);
    if (onlyGreen) {
      const threshold = Math.min(...rows.map((r) => r.co2e)) * 1.2; // top ~20% cleanest
      rows = rows.filter((r) => r.co2e <= threshold);
    }
    return rows.sort((a, b) => (sortBy === "price" ? a.price - b.price : sortBy === "eta" ? a.etaDays - b.etaDays : a.co2e - b.co2e));
  }, [quotes, maxPrice, sortBy, onlyGreen]);

  const ModeIcon = MODES.find((m) => m.id === mode)?.icon ?? Plane;

  return (
    <div className="w-full min-h-screen p-6 md:p-10 bg-gradient-to-b from-slate-50 to-white">
      <div className="max-w-6xl mx-auto grid gap-6">
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">FreightCompare</h1>
          <p className="text-slate-600 mt-1">Search live quotes across carriers, compare by price, speed, and emissions.</p>
        </motion.div>

        <Card className="shadow-sm">
          <CardContent className="p-4 md:p-6">
            <div className="grid md:grid-cols-4 gap-4 items-end">
              <div>
                <Label htmlFor="origin">Origin</Label>
                <Input id="origin" placeholder="e.g., Seattle, WA" value={origin} onChange={(e) => setOrigin(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="destination">Destination</Label>
                <Input id="destination" placeholder="e.g., Taipei, TW" value={destination} onChange={(e) => setDestination(e.target.value)} />
              </div>
              <div>
                <Label>Mode</Label>
                <Select value={mode} onValueChange={(v)=>setMode(v as ModeId)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select mode" />
                  </SelectTrigger>
                  <SelectContent>
                    {MODES.map((m) => (
                      <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Service</Label>
                <Select value={service} onValueChange={(v)=>setService(v as ServiceId)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select service" />
                  </SelectTrigger>
                  <SelectContent>
                    {SERVICE_LEVELS.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid md:grid-cols-5 gap-4 items-end mt-4">
              <div>
                <Label>Weight (kg)</Label>
                <Input type="number" value={weight} onChange={(e) => setWeight(parseInt(e.target.value || "0"))} />
              </div>
              <div>
                <Label>Length (cm)</Label>
                <Input type="number" value={length} onChange={(e) => setLength(parseInt(e.target.value || "0"))} />
              </div>
              <div>
                <Label>Width (cm)</Label>
                <Input type="number" value={width} onChange={(e) => setWidth(parseInt(e.target.value || "0"))} />
              </div>
              <div>
                <Label>Height (cm)</Label>
                <Input type="number" value={height} onChange={(e) => setHeight(parseInt(e.target.value || "0"))} />
              </div>
              <div className="flex gap-2 mt-6 md:mt-0">
                <Button className="w-full"><Search className="w-4 h-4 mr-2"/>Search quotes</Button>
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-4 mt-6">
              <Card className="border-dashed">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <ModeIcon className="w-4 h-4"/>
                    <span className="font-medium">Distance (est.)</span>
                  </div>
                  <p className="text-2xl mt-1">{distanceKm ? `${Math.round(distanceKm).toLocaleString()} km` : "—"}</p>
                </CardContent>
              </Card>
              <Card className="border-dashed">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <Leaf className="w-4 h-4"/>
                    <span className="font-medium">CO₂e (best)</span>
                  </div>
                  <p className="text-2xl mt-1">{quotes.length ? `${Math.min(...quotes.map(q=>q.co2e)).toLocaleString()} kg` : "—"}</p>
                </CardContent>
              </Card>
              <Card className="border-dashed">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <ArrowUpDown className="w-4 h-4"/>
                    <span className="font-medium">Sort & Filters</span>
                  </div>
                  <div className="mt-3 grid gap-3">
                    <div className="flex items-center gap-2">
                      <Label className="w-24">Sort by</Label>
                      <Select value={sortBy} onValueChange={(v: SortKey)=>setSortBy(v)}>
                        <SelectTrigger className="w-full"><SelectValue/></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="price">Price</SelectItem>
                          <SelectItem value="eta">ETA</SelectItem>
                          <SelectItem value="co2">Emissions</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-3">
                      <Label className="w-24">Max price</Label>
                      <Slider value={[maxPrice]} onValueChange={(v: number[])=>setMaxPrice(v[0])} min={100} max={10000} step={50} />
                      <span className="text-sm tabular-nums">{currency(maxPrice)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch id="green" checked={onlyGreen} onCheckedChange={setOnlyGreen}/>
                      <Label htmlFor="green">Show only lower‑emission options</Label>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

          </CardContent>
        </Card>

        <Tabs defaultValue="table" className="w-full">
          <TabsList>
            <TabsTrigger value="table">Table</TabsTrigger>
            <TabsTrigger value="cards">Cards</TabsTrigger>
          </TabsList>
          <TabsContent value="table">
            <Card className="shadow-sm">
              <CardContent className="p-0">
                <Table>
                  <TableCaption className="text-left p-4">Quotes are illustrative for MVP. Hook up carrier APIs to fetch live rates.</TableCaption>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Carrier</TableHead>
                      <TableHead>Mode</TableHead>
                      <TableHead>Service</TableHead>
                      <TableHead className="text-right">Price</TableHead>
                      <TableHead className="text-right">ETA (days)</TableHead>
                      <TableHead className="text-right">CO₂e (kg)</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSorted.map((q) => (
                      <TableRow key={q.carrier+q.price}>
                        <TableCell className="font-medium">{q.carrier}</TableCell>
                        <TableCell className="capitalize">{q.mode}</TableCell>
                        <TableCell className="capitalize">{q.service}</TableCell>
                        <TableCell className="text-right tabular-nums">{currency(q.price)}</TableCell>
                        <TableCell className="text-right">{q.etaDays}</TableCell>
                        <TableCell className="text-right">{q.co2e.toLocaleString()}</TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="secondary">Book</Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {!filteredSorted.length && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-slate-500 py-10">Enter shipment details to see quotes.</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="cards">
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredSorted.map((q) => (
                <Card key={q.carrier+q.etaDays} className="shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="font-semibold">{q.carrier}</div>
                      <Badge variant="secondary" className="capitalize">{q.mode}</Badge>
                    </div>
                    <div className="mt-2 text-2xl">{currency(q.price)}</div>
                    <div className="text-sm text-slate-600">{q.service}</div>
                    <div className="grid grid-cols-3 gap-2 mt-3 text-sm">
                      <div className="text-center p-2 bg-slate-50 rounded-xl">
                        <div className="font-medium">{q.etaDays}</div>
                        <div className="text-slate-500">days</div>
                      </div>
                      <div className="text-center p-2 bg-slate-50 rounded-xl">
                        <div className="font-medium">{q.co2e.toLocaleString()}</div>
                        <div className="text-slate-500">kg CO₂e</div>
                      </div>
                      <div className="text-center p-2 bg-slate-50 rounded-xl">
                        <div className="font-medium">{Math.round(q.price / q.etaDays).toLocaleString()}</div>
                        <div className="text-slate-500">$/day</div>
                      </div>
                    </div>
                    <div className="mt-4 flex justify-end">
                      <Button>Book</Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {!filteredSorted.length && (
                <div className="text-center text-slate-500 py-10">Enter shipment details to see quotes.</div>
              )}
            </div>
          </TabsContent>
        </Tabs>

        <Card className="bg-slate-50 border-dashed">
          <CardContent className="p-4 md:p-6">
            <h2 className="text-lg font-semibold">Next steps to make this real</h2>
            <ul className="list-disc pl-5 mt-2 text-slate-700 space-y-1">
              <li><span className="font-medium">APIs:</span> connect carrier/rate APIs (e.g., DHL, FedEx, Maersk), or a freight marketplace aggregator. Map responses to the quote schema used above.</li>
              <li><span className="font-medium">Geocoding & distance:</span> replace the distance placeholder with a real geocoding + distance service.</li>
              <li><span className="font-medium">Dim weight rules:</span> implement per-carrier rules for chargeable weight (IATA/road/ocean conventions).</li>
              <li><span className="font-medium">Bookings & docs:</span> create checkout flow with shipper/consignee details, INCOterms, and label/BOL generation.</li>
              <li><span className="font-medium">Auth & pricing:</span> add auth, saved quotes, and negotiated rate handling.</li>
              <li><span className="font-medium">Observability:</span> log requests, retries, and SLAs to monitor provider health.</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
