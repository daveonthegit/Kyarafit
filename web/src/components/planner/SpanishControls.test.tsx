import { fireEvent, render, screen, cleanup } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import messages from "../../../messages/es.json";
import { PlannerTaskRow } from "./PlannerWorkflowTaskUi";
import { BuildExplorerToolbar } from "../builds/explorer/BuildExplorerToolbar";
import { BuildNodeManagerSection } from "../builds/BuildNodeManagerSection";
import type { Id } from "convex/_generated/dataModel";

vi.mock("@/lib/offline", () => ({ useOfflineQuery: () => [] }));
vi.mock("../builds/explorer/useNodeInspector", () => ({
  useNodeInspector: () => ({ selected: null, selectedPath: [] }),
}));
vi.mock("../builds/explorer/useExplorerDrag", () => ({
  useExplorerDrag: () => ({ drag: {}, graphError: null }),
}));

afterEach(cleanup);

describe("Spanish planning controls", () => {
  it("translates empty explorer instructions and keeps both actions working", () => {
    const onCreateRoot = vi.fn();
    const onOpenLinkNodes = vi.fn();
    render(
      <NextIntlClientProvider locale="es" messages={messages}>
        <BuildNodeManagerSection
          buildId={"build_1" as Id<"builds">}
          buildName="Capa"
          userId="user_1"
          linkedNodes={[]}
          linkedNodeIds={[]}
          onCreateRoot={onCreateRoot}
          onOpenLinkNodes={onOpenLinkNodes}
          onCreateChild={vi.fn()}
        />
      </NextIntlClientProvider>
    );
    expect(
      screen.getByText("Añade tu primer elemento para empezar a desglosar este build.")
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Nuevo elemento principal/ }));
    expect(onCreateRoot).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: /Vincular/ }));
    expect(onOpenLinkNodes).toHaveBeenCalledOnce();
  });

  it("translates task disclosure in both states", () => {
    render(
      <NextIntlClientProvider locale="es" messages={messages}>
        <PlannerTaskRow
          title="Coser capa"
          done={false}
          userId="user_1"
          onToggle={() => {}}
          contextHref="/build-detail/b1"
          contextLabel="Capa"
          status="in_progress"
          progressPercent={40}
          priority={3}
          blockedByCount={2}
          blockedByTitles={["Cortar tela", "Comprar hilo"]}
          dragHandleProps={{
            hasChildren: true,
            childrenOpen: true,
            onToggleChildren: vi.fn(),
            onPointerDown: vi.fn(),
          }}
        />
      </NextIntlClientProvider>
    );
    const disclosure = screen.getByRole("button", { name: 'Mostrar detalles de "Coser capa"' });
    expect(disclosure).toHaveTextContent("Detalles");
    expect(disclosure).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(disclosure);
    const expanded = screen.getByRole("button", { name: 'Ocultar detalles de "Coser capa"' });
    expect(expanded).toHaveTextContent("Menos");
    expect(expanded).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Estado")).toBeInTheDocument();
    expect(screen.getByText("en curso")).toBeInTheDocument();
    expect(screen.getByText("Prioridad")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("Dependencias")).toBeInTheDocument();
    expect(screen.getByText("bloqueada por Cortar tela, Comprar hilo")).toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", { name: 'Marcar "Coser capa" como completa' })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: 'Arrastrar "Coser capa"' })).toHaveAttribute(
      "title",
      "Arrastra para reordenar, anidar o subir de nivel"
    );
    expect(screen.getByRole("button", { name: "Contraer tarea" })).toBeInTheDocument();
    fireEvent.click(expanded);
    expect(disclosure).toHaveAttribute("aria-expanded", "false");
  });

  it.each([
    ["not_started", "sin empezar"],
    ["scheduled", "programada"],
    ["in_progress", "en curso"],
    ["blocked", "bloqueada"],
    ["waiting", "en espera"],
    ["done", "hecha"],
    ["cancelled", "cancelada"],
  ])("translates %s and count-only dependencies", (status, label) => {
    render(
      <NextIntlClientProvider locale="es" messages={messages}>
        <PlannerTaskRow
          title="Capa"
          done={status === "done"}
          userId="u1"
          onToggle={vi.fn()}
          contextHref="/builds"
          contextLabel="Build"
          status={status}
          progressPercent={0}
          blockedByCount={2}
        />
      </NextIntlClientProvider>
    );
    fireEvent.click(screen.getByRole("button", { name: 'Mostrar detalles de "Capa"' }));
    expect(screen.getByText(label)).toBeInTheDocument();
    expect(screen.getByText("bloqueada por 2")).toBeInTheDocument();
    expect(screen.getByRole("checkbox")).toHaveAccessibleName(
      status === "done" ? 'Marcar "Capa" como incompleta' : 'Marcar "Capa" como completa'
    );
  });

  it("translates explorer actions, search, and singular/plural counts", () => {
    const onSearchChange = vi.fn();
    const onCreateRoot = vi.fn();
    const onOpenLinkNodes = vi.fn();
    const toolbar = (rootCount: number, search = "", matchCount?: number) => (
      <NextIntlClientProvider locale="es" messages={messages}>
        <BuildExplorerToolbar
          search={search}
          rootCount={rootCount}
          matchCount={matchCount}
          onSearchChange={onSearchChange}
          onCreateRoot={onCreateRoot}
          onOpenLinkNodes={onOpenLinkNodes}
        />
      </NextIntlClientProvider>
    );
    const { rerender } = render(toolbar(1));
    const search = screen.getByRole("textbox", { name: "Buscar elementos vinculados" });
    expect(search).toHaveAttribute("placeholder", "Buscar elementos vinculados…");
    fireEvent.change(search, { target: { value: "capa" } });
    expect(onSearchChange).toHaveBeenLastCalledWith("capa");
    fireEvent.click(screen.getByRole("button", { name: /Nuevo elemento principal/ }));
    expect(onCreateRoot).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: /Vincular/ }));
    expect(onOpenLinkNodes).toHaveBeenCalledOnce();
    expect(screen.getByText("1 elemento principal")).toBeInTheDocument();
    rerender(toolbar(2));
    expect(screen.getByText("2 elementos principales")).toBeInTheDocument();
    rerender(toolbar(2, "capa", 1));
    expect(screen.getByText("1 coincidencia")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Borrar filtro" }));
    expect(onSearchChange).toHaveBeenLastCalledWith("");
    rerender(toolbar(2, "capa", 0));
    expect(screen.getByText("0 coincidencias")).toBeInTheDocument();
    rerender(toolbar(2, "capa", 2));
    expect(screen.getByText("2 coincidencias")).toBeInTheDocument();
  });
});
