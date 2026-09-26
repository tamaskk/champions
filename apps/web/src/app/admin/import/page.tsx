import { CLUB_IMPORT_SAMPLE, FIRST_SEASON, LEAGUES } from "@champion/shared";

import { DownloadIcon, FileIcon, UploadIcon } from "@/components/admin/icons";
import { Card, PageHeader, buttonClass } from "@/components/admin/ui";

import { DecadePrompt } from "./decade-prompt";
import { ImportForm } from "./import-form";

const code = "rounded bg-panel px-1.5 py-0.5 font-mono text-xs text-ink";

export default function ImportPage() {
  return (
    <>
      <PageHeader title="Import clubs">
        <a href="/admin/import/sample" download className={buttonClass.secondary}>
          <DownloadIcon />
          Sample JSON
        </a>
      </PageHeader>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-5">
          <Card title="Upload" icon={UploadIcon}>
            <ImportForm />
          </Card>
          <DecadePrompt />
        </div>

        <Card
          title="Format"
          icon={FileIcon}
          action={
            <a href="/admin/import/sample" download className={buttonClass.secondary}>
              <DownloadIcon />
              Download
            </a>
          }
        >
          <p className="text-sm leading-relaxed text-muted">
            One entry per league season, listing the clubs that played in it. Importing the same club, league and
            season again updates it instead of duplicating it.
          </p>

          <pre className="mt-4 max-h-96 overflow-auto rounded-xl bg-ink p-4 font-mono text-xs leading-relaxed text-white/90">
            {JSON.stringify(CLUB_IMPORT_SAMPLE, null, 2)}
          </pre>

          <dl className="mt-5 grid grid-cols-[auto_1fr] gap-x-4 gap-y-3 text-sm">
            <dt>
              <code className={code}>version</code>
            </dt>
            <dd className="text-muted">Always 1.</dd>
            <dt>
              <code className={code}>source</code>
            </dt>
            <dd className="text-muted">Optional. Where the data came from. An entry can override it with its own.</dd>
            <dt>
              <code className={code}>league</code>
            </dt>
            <dd className="text-muted">
              {LEAGUES.join(", ")}. Names like &quot;Bundesliga&quot; or &quot;Serie A&quot; also work.
            </dd>
            <dt>
              <code className={code}>season</code>
            </dt>
            <dd className="text-muted">
              Start year, {FIRST_SEASON} or later: <code className={code}>1975</code> or{" "}
              <code className={code}>&quot;1975/76&quot;</code> both mean 1975/76.
            </dd>
            <dt>
              <code className={code}>clubs</code>
            </dt>
            <dd className="text-muted">Club names as they should appear in the game.</dd>
          </dl>
          <p className="mt-5 text-sm text-muted">
            If any entry has an error, nothing is imported. Fix the file and upload it again.
          </p>
        </Card>
      </div>
    </>
  );
}
