import { fireEvent, render, screen, cleanup } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import messages from "../../../messages/es.json";
import { PlannerTaskRow } from "./PlannerWorkflowTaskUi";
import { BuildExplorerToolbar } from "../builds/explorer/BuildExplorerToolbar";

afterEach(cleanup);

describe("Spanish planning controls", () => {
  it("translates task disclosure in both states", () => {
    render(
      <NextIntlClientProvider locale="es" messages={messages}>
        <PlannerTaskRow title="Coser capa" done={false} userId="user_1" onToggle={() => {}}
          contextHref="/build-detail/b1" contextLabel="Capa" status="in_progress" progressPercent={40} />
      </NextIntlClientProvider>
    );
    const disclosure = screen.getByRole("button", { name: 'Mostrar detalles de "Coser capa"' });
    expect(disclosure).toHaveTextContent("Detalles");
    expect(disclosure).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(disclosure);
    const expanded = screen.getByRole("button", { name: 'Ocultar detalles de "Coser capa"' });
    expect(expanded).toHaveTextContent("Menos");
    expect(expanded).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(expanded);
    expect(disclosure).toHaveAttribute("aria-expanded", "false");
  });

  it("translates explorer actions, search, and singular/plural counts", () => {
    const onSearchChange = vi.fn();
    const onCreateRoot = vi.fn();
    const onOpenLinkNodes = vi.fn();
    const toolbar = (rootCount: number, search = "", matchCount?: number) => (
      <NextIntlClientProvider locale="es" messages={messages}>
        <BuildExplorerToolbar search={search} rootCount={rootCount} matchCount={matchCount}
          onSearchChange={onSearchChange} onCreateRoot={onCreateRoot} onOpenLinkNodes={onOpenLinkNodes} />
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
