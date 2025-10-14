export const CommentRow = (data) => `
<tr data-cid="{{cid}}">
    <td role="text">{{text}}</td>
    <td role="sentiment">{{sentiment}}</td>
    <td role="civility">{{civility}}</td>
    <td role="aims">{{aims}}</td>
    <td role="categories">{{categories}}</td>
    <td role="themes">{{themes}}</td>

    <td role="subject">{{subject}}</td>
    <td role="editing" class="d-none text-center">
        <button class="btn bi-arrow-clockwise px-2" role="process"></button>
        <button class="btn text-byu-plum bi-trash px-2" role="delete"></button>
    </td>
</tr>
`;

export const ReportListItem = (data) => `
    <div class="col report-list-item">
        <a href="/report/{{rid}}"
            class="btn btn-link text-byu py-4 text-decoration-none w-100 border rounded">
            <div class="bi-table fs-1"></div>
            <div class="mx-3 fs-3 my-3">{{name}}</div>
            <div class="text-secondary my-2">{{date}}  | {{comments_count}} comments</div>
        </a>
        <div class="btn-group w-100 my-1 d-none" role="editing">
            <button class="btn btn-light text-byu-plum bi-trash" role="delete"></button>
        </div>
    </div>
`;

export const Placeholder = `
    <div class="placeholder-glow px-2">
        <div class="placeholder w-100 rounded">
        </div>
    </div>
`;
