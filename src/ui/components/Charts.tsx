import React from "react";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from "recharts";
import type { Patient } from "../types";

const COLORS = ["#2563eb", "#7c3aed", "#00b4a0", "#f97316", "#ec4899", "#22c55e"];

interface PatientTrendsChartProps {
  patients: Patient[];
}

export function PatientTrendsChart({ patients }: PatientTrendsChartProps) {
  const monthlyData = React.useMemo(() => {
    const months: Record<string, number> = {};
    
    patients.forEach(p => {
      if (p.createdAt) {
        const date = new Date(p.createdAt);
        const key = date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
        months[key] = (months[key] || 0) + 1;
      }
    });

    return Object.entries(months)
      .map(([month, count]) => ({ month, count }))
      .sort((a, b) => {
        const [aMonth, aYear] = a.month.split(' ');
        const [bMonth, bYear] = b.month.split(' ');
        const monthOrder = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        if (aYear !== bYear) return aYear.localeCompare(bYear);
        return monthOrder.indexOf(aMonth) - monthOrder.indexOf(bMonth);
      })
      .slice(-6);
  }, [patients]);

  return (
    <div className="card card-padded">
      <h3 style={{ fontSize: "var(--font-md)", fontWeight: 700, marginBottom: 16 }}>
        <i className="ti ti-trending-up" style={{ marginRight: 6 }} />
        Patient Registration Trends
      </h3>
      <ResponsiveContainer width="100%" height={250}>
        <LineChart data={monthlyData}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis 
            dataKey="month" 
            stroke="var(--muted)"
            fontSize={12}
            tick={{ fill: "var(--muted)" }}
          />
          <YAxis 
            stroke="var(--muted)"
            fontSize={12}
            tick={{ fill: "var(--muted)" }}
          />
          <Tooltip 
            contentStyle={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius)",
              color: "var(--text)"
            }}
          />
          <Line 
            type="monotone" 
            dataKey="count" 
            stroke="#2563eb" 
            strokeWidth={2}
            dot={{ fill: "#2563eb", strokeWidth: 2, r: 4 }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

interface PatientStatusChartProps {
  patients: Patient[];
}

export function PatientStatusChart({ patients }: PatientStatusChartProps) {
  const statusData = React.useMemo(() => {
    const statusCounts: Record<string, number> = {};
    patients.forEach(p => {
      statusCounts[p.status] = (statusCounts[p.status] || 0) + 1;
    });

    return Object.entries(statusCounts).map(([status, count]) => ({
      name: status,
      value: count
    }));
  }, [patients]);

  return (
    <div className="card card-padded">
      <h3 style={{ fontSize: "var(--font-md)", fontWeight: 700, marginBottom: 16 }}>
        <i className="ti ti-users-group" style={{ marginRight: 6 }} />
        Patient Status Distribution
      </h3>
      <ResponsiveContainer width="100%" height={250}>
        <PieChart>
          <Pie
            data={statusData}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
            outerRadius={80}
            fill="#8884d8"
            dataKey="value"
          >
            {statusData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip 
            contentStyle={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius)",
              color: "var(--text)"
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

interface DoctorWorkloadChartProps {
  patients: Patient[];
}

export function DoctorWorkloadChart({ patients }: DoctorWorkloadChartProps) {
  const doctorData = React.useMemo(() => {
    const doctorCounts: Record<string, number> = {};
    patients.forEach(p => {
      doctorCounts[p.doctor] = (doctorCounts[p.doctor] || 0) + 1;
    });

    return Object.entries(doctorCounts)
      .map(([doctor, count]) => ({ doctor, patients: count }))
      .sort((a, b) => b.patients - a.patients);
  }, [patients]);

  return (
    <div className="card card-padded">
      <h3 style={{ fontSize: "var(--font-md)", fontWeight: 700, marginBottom: 16 }}>
        <i className="ti ti-stethoscope" style={{ marginRight: 6 }} />
        Doctor Workload
      </h3>
      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={doctorData}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis 
            dataKey="doctor" 
            stroke="var(--muted)"
            fontSize={11}
            tick={{ fill: "var(--muted)" }}
            angle={-45}
            textAnchor="end"
            height={60}
          />
          <YAxis 
            stroke="var(--muted)"
            fontSize={12}
            tick={{ fill: "var(--muted)" }}
          />
          <Tooltip 
            contentStyle={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius)",
              color: "var(--text)"
            }}
          />
          <Bar dataKey="patients" fill="#7c3aed" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

interface InsuranceChartProps {
  patients: Patient[];
}

export function InsuranceChart({ patients }: InsuranceChartProps) {
  const insuranceData = React.useMemo(() => {
    const insuranceCounts: Record<string, number> = {};
    patients.forEach(p => {
      insuranceCounts[p.insuranceStatus] = (insuranceCounts[p.insuranceStatus] || 0) + 1;
    });

    return Object.entries(insuranceCounts).map(([status, count]) => ({
      name: status,
      value: count
    }));
  }, [patients]);

  const statusColors: Record<string, string> = {
    "Active": "#22c55e",
    "Expiring": "#f97316",
    "Expired": "#dc2626",
    "None": "#6b7280"
  };

  return (
    <div className="card card-padded">
      <h3 style={{ fontSize: "var(--font-md)", fontWeight: 700, marginBottom: 16 }}>
        <i className="ti ti-shield-check" style={{ marginRight: 6 }} />
        Insurance Status
      </h3>
      <ResponsiveContainer width="100%" height={250}>
        <PieChart>
          <Pie
            data={insuranceData}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
            outerRadius={80}
            fill="#8884d8"
            dataKey="value"
          >
            {insuranceData.map((entry) => (
              <Cell key={`cell-${entry.name}`} fill={statusColors[entry.name] || "#6b7280"} />
            ))}
          </Pie>
          <Tooltip 
            contentStyle={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius)",
              color: "var(--text)"
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

interface RiskDistributionChartProps {
  patients: Patient[];
}

export function RiskDistributionChart({ patients }: RiskDistributionChartProps) {
  const riskData = React.useMemo(() => {
    const riskCounts: Record<string, number> = {
      "Low": 0,
      "Medium": 0,
      "High": 0,
      "Critical": 0
    };

    patients.forEach(p => {
      const alertCount = (p.alerts || []).length;
      if (alertCount === 0) riskCounts["Low"]++;
      else if (alertCount <= 1) riskCounts["Medium"]++;
      else if (alertCount <= 2) riskCounts["High"]++;
      else riskCounts["Critical"]++;
    });

    return Object.entries(riskCounts).map(([risk, count]) => ({
      risk,
      patients: count
    }));
  }, [patients]);

  const riskColors: Record<string, string> = {
    "Low": "#22c55e",
    "Medium": "#f97316",
    "High": "#dc2626",
    "Critical": "#7c3aed"
  };

  return (
    <div className="card card-padded">
      <h3 style={{ fontSize: "var(--font-md)", fontWeight: 700, marginBottom: 16 }}>
        <i className="ti ti-alert-triangle" style={{ marginRight: 6 }} />
        Risk Distribution
      </h3>
      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={riskData}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis 
            dataKey="risk" 
            stroke="var(--muted)"
            fontSize={12}
            tick={{ fill: "var(--muted)" }}
          />
          <YAxis 
            stroke="var(--muted)"
            fontSize={12}
            tick={{ fill: "var(--muted)" }}
          />
          <Tooltip 
            contentStyle={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius)",
              color: "var(--text)"
            }}
          />
          <Bar 
            dataKey="patients" 
            radius={[4, 4, 0, 0]}
          >
            {riskData.map((entry) => (
              <Cell key={entry.risk} fill={riskColors[entry.risk]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
